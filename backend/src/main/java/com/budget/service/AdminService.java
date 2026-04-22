package com.budget.service;

import com.budget.dto.UserCreateRequest;
import com.budget.entity.*;
import com.budget.repository.*;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AdminService {

    private final UserRepository userRepository;
    private final RequestRepository requestRepository;
    private final BudgetRepository budgetRepository;
    private final AdminBudgetRepository adminBudgetRepository;
    private final RequestHistoryRepository requestHistoryRepository;
    private final PasswordEncoder passwordEncoder;
    private final JavaMailSender mailSender;

    public AdminService(UserRepository userRepository, RequestRepository requestRepository, BudgetRepository budgetRepository, AdminBudgetRepository adminBudgetRepository, RequestHistoryRepository requestHistoryRepository, PasswordEncoder passwordEncoder, JavaMailSender mailSender) {
        this.userRepository = userRepository;
        this.requestRepository = requestRepository;
        this.budgetRepository = budgetRepository;
        this.adminBudgetRepository = adminBudgetRepository;
        this.requestHistoryRepository = requestHistoryRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailSender = mailSender;
    }

    @Transactional
    public User createUser(UserCreateRequest dto, String adminId) {
        if (userRepository.findByEmail(dto.getEmail()).isPresent()) {
            throw new RuntimeException("Email already exists");
        }
        
        if (dto.getRole() == Role.MANAGER && dto.getDepartment() != null && !dto.getDepartment().trim().isEmpty()) {
            if (userRepository.existsByRoleAndDepartment(Role.MANAGER, dto.getDepartment())) {
                throw new RuntimeException("A manager already exists for this department");
            }
        }
        
        User user = new User();
        
        String prefix = "emp";
        if (dto.getRole() == Role.MANAGER) prefix = "mgr";
        else if (dto.getRole() == Role.ADMIN) prefix = "adm";

        String finalPrefix = prefix;
        User lastUser = userRepository.findFirstByRoleOrderByUserIdDesc(dto.getRole()).orElse(null);
        int nextIdNum = 101;
        if (lastUser != null && lastUser.getUserId() != null && lastUser.getUserId().startsWith(finalPrefix)) {
            try {
                nextIdNum = Integer.parseInt(lastUser.getUserId().substring(finalPrefix.length())) + 1;
            } catch (Exception ignored) {}
        }
        user.setUserId(finalPrefix + nextIdNum);
        
        user.setName(dto.getName());
        user.setEmail(dto.getEmail());
        String rawPassword = dto.getPassword();
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setRole(dto.getRole());
        user.setManagerId(dto.getManagerId());
        
        if (dto.getRole() != Role.ADMIN) {
            user.setDepartment(dto.getDepartment());
        }
        
        user.setSpecialKey(dto.getSpecialKey());
        User savedUser = userRepository.save(user);

        if (dto.getRole() == Role.MANAGER && dto.getBudgetAmount() != null && dto.getBudgetAmount() > 0) {
            if (adminId == null || adminId.isEmpty()) {
                AdminBudget defaultAdminBudget = adminBudgetRepository.findAll().stream().findFirst()
                        .orElseThrow(() -> new RuntimeException("No admin budget found to assign from"));
                adminId = defaultAdminBudget.getAdminId();
            }
            assignBudget(adminId, savedUser.getUserId(), dto.getBudgetAmount());
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(savedUser.getEmail());
            message.setSubject("Your Account Details");
            message.setText("Hello " + savedUser.getName() + ",\n\n"
                    + "Your account has been created!\n\n"
                    + "Email: " + savedUser.getEmail() + "\n"
                    + "Password: " + rawPassword + "\n"
                    + "Role: " + (savedUser.getRole().name().charAt(0) + savedUser.getRole().name().substring(1).toLowerCase()) + "\n"
                    + (savedUser.getDepartment() != null ? "Department: " + savedUser.getDepartment() + "\n" : "")
                    + "\nThanks,\nAdmin");
            mailSender.send(message);
        } catch (Exception e) {
            System.err.println("Failed to send welcome email: " + e.getMessage());
        }

        return savedUser;
    }

    @Transactional
    public Budget assignBudget(String adminId, String managerId, Double amount) {
        User manager = userRepository.findByUserId(managerId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (manager.getRole() != Role.MANAGER) {
            throw new RuntimeException("You can only assign budget to a MANAGER");
        }

        AdminBudget adminBudget = adminBudgetRepository.findByAdminId(adminId)
                .orElseThrow(() -> new RuntimeException("Admin budget not found"));

        if (adminBudget.getRemainingBudget() < amount) {
            throw new RuntimeException("Insufficient admin budget to allocate");
        }
        
        Budget budget = budgetRepository.findByManagerId(managerId).orElse(new Budget());
        budget.setManagerId(managerId);
        budget.setTotalBudget(budget.getTotalBudget() + amount);

        adminBudget.setUsedBudget(adminBudget.getUsedBudget() + amount);
        adminBudgetRepository.save(adminBudget);
        Budget savedBudget = budgetRepository.save(budget);

        RequestHistory history = new RequestHistory();
        history.setRequestId(null);
        history.setAction("BUDGET_ASSIGNED");
        history.setActionBy(adminId);
        requestHistoryRepository.save(history);

        return savedBudget;
    }

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public List<Budget> getAllBudgets() {
        return budgetRepository.findAll();
    }

    public List<RequestHistory> getAllHistory() {
        return requestHistoryRepository.findAll();
    }

    public List<Request> getEscalatedRequests() {
        return requestRepository.findByStatus(Status.ESCALATED); // Assuming I need to update repo
    }

    @Transactional
    public Request handleEscalatedRequest(Long requestId, String action, String adminId) {
        Request request = requestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));
        
        if (request.getStatus() != Status.ESCALATED) {
            throw new RuntimeException("You can only act on ESCALATED requests");
        }

        String actionTaken;
        if ("APPROVE".equalsIgnoreCase(action)) {
            AdminBudget adminBudget = adminBudgetRepository.findByAdminId(adminId)
                    .orElseThrow(() -> new RuntimeException("Admin budget not found"));

            if (adminBudget.getRemainingBudget() < request.getAmount()) {
                throw new RuntimeException("Admin budget insufficient to approve this request");
            }
            adminBudget.setUsedBudget(adminBudget.getUsedBudget() + request.getAmount());
            adminBudgetRepository.save(adminBudget);

            request.setStatus(Status.APPROVED);
            actionTaken = "APPROVED";
        } else if ("REJECT".equalsIgnoreCase(action)) {
            Budget managerBudget = budgetRepository.findByManagerId(request.getManagerId())
                    .orElseThrow(() -> new RuntimeException("Manager budget not found"));
            managerBudget.setReservedBudget(Math.max(0, managerBudget.getReservedBudget() - request.getAmount()));
            budgetRepository.save(managerBudget);

            request.setStatus(Status.REJECTED);
            actionTaken = "REJECTED";
        } else {
            throw new RuntimeException("Invalid action");
        }

        requestRepository.save(request);

        RequestHistory history = new RequestHistory();
        history.setRequestId(request.getId());
        history.setAction(actionTaken);
        history.setActionBy(adminId);
        requestHistoryRepository.save(history);

        return request;
    }
}
