package com.mulaerp.service;

import com.mulaerp.entity.Employee;
import com.mulaerp.repository.EmployeeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class EmployeeService {

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private CasUserService casUserService;

    @Cacheable(value = "employees", key = "'all'")
    public List<Employee> getAllEmployees() {
        return employeeRepository.findAll();
    }

    @Cacheable(value = "employees", key = "#id")
    public Optional<Employee> getEmployeeById(String id) {
        return employeeRepository.findById(id);
    }

    @CacheEvict(value = "employees", allEntries = true)
    public Employee createEmployee(Employee employee) {
        employee.setId(generateEmployeeId());
        employee.setCreatedAt(LocalDateTime.now());
        employee.setUpdatedAt(LocalDateTime.now());
        
        // Create user in CAS system
        try {
            casUserService.createUser(employee);
        } catch (Exception e) {
            System.err.println("Failed to create CAS user for employee: " + e.getMessage());
            // Continue with employee creation even if CAS fails
        }
        
        return employeeRepository.save(employee);
    }

    @CacheEvict(value = "employees", allEntries = true)
    public Employee updateEmployee(String id, Employee employee) {
        employee.setId(id);
        employee.setUpdatedAt(LocalDateTime.now());
        
        // Update user in CAS system
        try {
            casUserService.updateUser(employee);
        } catch (Exception e) {
            System.err.println("Failed to update CAS user for employee: " + e.getMessage());
        }
        
        return employeeRepository.save(employee);
    }

    @CacheEvict(value = "employees", allEntries = true)
    public void deleteEmployee(String id) {
        // Deactivate user in CAS system
        try {
            casUserService.deactivateUser(id);
        } catch (Exception e) {
            System.err.println("Failed to deactivate CAS user for employee: " + e.getMessage());
        }
        
        employeeRepository.deleteById(id);
    }

    public List<Employee> getEmployeesByDepartment(String department) {
        return employeeRepository.findByDepartment(department);
    }

    public List<Employee> getEmployeesByStatus(String status) {
        return employeeRepository.findByStatus(status);
    }

    public List<Employee> searchEmployees(String searchTerm) {
        return employeeRepository.searchByNameOrEmail(searchTerm);
    }

    private String generateEmployeeId() {
        return "EMP" + System.currentTimeMillis();
    }
}