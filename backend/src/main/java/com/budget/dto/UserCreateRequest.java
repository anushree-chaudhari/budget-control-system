package com.budget.dto;

import com.budget.entity.Role;
import lombok.Data;

@Data
public class UserCreateRequest {
    private String userId;
    private String name;
    private String email;
    private String password;
    private Role role;
    private String managerId; // Can be null if role is ADMIN or MANAGER
    private String department;
    private String specialKey;
    private Double budgetAmount;
}
