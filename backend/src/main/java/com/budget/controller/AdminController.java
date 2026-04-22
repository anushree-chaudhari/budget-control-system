package com.budget.controller;

import com.budget.dto.UserCreateRequest;
import com.budget.entity.Budget;
import com.budget.entity.Request;
import com.budget.entity.User;
import com.budget.service.AdminService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin")
public class AdminController {

    private final AdminService adminService;
    private final com.budget.repository.AdminBudgetRepository adminBudgetRepository;
    private final com.budget.service.NotificationService notificationService;

    public AdminController(AdminService adminService, com.budget.repository.AdminBudgetRepository adminBudgetRepository, com.budget.service.NotificationService notificationService) {
        this.adminService = adminService;
        this.adminBudgetRepository = adminBudgetRepository;
        this.notificationService = notificationService;
    }

    @PostMapping("/create-user")
    public ResponseEntity<?> createUser(@RequestBody UserCreateRequest request, @RequestHeader(value = "X-User-Id", required = false) String adminId) {
        try {
            User user = adminService.createUser(request, adminId);
            return ResponseEntity.ok("User created successfully with ID: " + user.getId());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/assign-budget")
    public ResponseEntity<?> assignBudget(@RequestBody Map<String, Object> payload, @RequestHeader("X-User-Id") String adminId) {
        try {
            String managerId = (String) payload.get("managerId");
            Double amount = Double.valueOf(payload.get("totalBudget").toString());
            Budget budget = adminService.assignBudget(adminId, managerId, amount);
            return ResponseEntity.ok(budget);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/my-budget")
    public ResponseEntity<?> getMyBudget(@RequestHeader("X-User-Id") String adminId) {
        try {
            return adminBudgetRepository.findByAdminId(adminId)
                    .map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/set-total-budget")
    public ResponseEntity<?> setTotalBudget(@RequestBody Map<String, Object> payload, @RequestHeader("X-User-Id") String adminId) {
        try {
            Double totalBudget = Double.valueOf(payload.get("totalBudget").toString());

            com.budget.entity.AdminBudget adminBudget = adminBudgetRepository.findByAdminId(adminId).orElse(new com.budget.entity.AdminBudget());
            
            if (adminBudget.getId() != null && adminBudget.getTotalBudget() > 0) {
                return ResponseEntity.badRequest().body("Budget already initialized. Use top-up.");
            }

            adminBudget.setAdminId(adminId);
            adminBudget.setTotalBudget(totalBudget);
            // reset used budget just in case
            adminBudget.setUsedBudget(0.0);
            
            adminBudgetRepository.save(adminBudget);
            
            return ResponseEntity.ok(adminBudget);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/all-users")
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(adminService.getAllUsers());
    }

    @GetMapping("/all-budgets")
    public ResponseEntity<List<Budget>> getAllBudgets() {
        return ResponseEntity.ok(adminService.getAllBudgets());
    }

    @GetMapping("/all-requests")
    public ResponseEntity<List<Request>> getEscalatedRequests() {
        return ResponseEntity.ok(adminService.getEscalatedRequests());
    }

    @GetMapping("/all-history")
    public ResponseEntity<List<com.budget.entity.RequestHistory>> getAllHistory() {
        return ResponseEntity.ok(adminService.getAllHistory());
    }
    
    @PostMapping("/action")
    public ResponseEntity<?> actionRequest(@RequestBody Map<String, Object> payload, @RequestHeader("X-User-Id") String adminId) {
        try {
            Long requestId = Long.valueOf(payload.get("requestId").toString());
            String action = (String) payload.get("action");
            
            Request processed = adminService.handleEscalatedRequest(requestId, action, adminId);
            return ResponseEntity.ok(processed);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/notifications")
    public ResponseEntity<List<com.budget.entity.Notification>> getNotifications(@RequestHeader("X-User-Id") String adminId) {
        return ResponseEntity.ok(notificationService.getNotificationsForAdmin(adminId));
    }

    @PostMapping("/mark-read/{id}")
    public ResponseEntity<com.budget.entity.Notification> markAsRead(@PathVariable Long id) {
        return ResponseEntity.ok(notificationService.markAsRead(id));
    }
}
