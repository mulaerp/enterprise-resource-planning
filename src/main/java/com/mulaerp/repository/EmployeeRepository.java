package com.mulaerp.repository;

import com.mulaerp.entity.Employee;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public class EmployeeRepository {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final RowMapper<Employee> employeeRowMapper = new EmployeeRowMapper();

    public List<Employee> findAll() {
        String sql = "SELECT * FROM employees ORDER BY created_at DESC";
        return jdbcTemplate.query(sql, employeeRowMapper);
    }

    public Optional<Employee> findById(String id) {
        String sql = "SELECT * FROM employees WHERE id = ?";
        List<Employee> employees = jdbcTemplate.query(sql, employeeRowMapper, id);
        return employees.isEmpty() ? Optional.empty() : Optional.of(employees.get(0));
    }

    public Employee save(Employee employee) {
        if (findById(employee.getId()).isPresent()) {
            return update(employee);
        } else {
            return insert(employee);
        }
    }

    private Employee insert(Employee employee) {
        String sql = """
            INSERT INTO employees (id, name, email, phone, position, department, hire_date, 
                                 salary, status, manager, address, emergency_contact_name, 
                                 emergency_contact_phone, emergency_contact_relationship, 
                                 created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;
        
        jdbcTemplate.update(sql,
            employee.getId(), employee.getName(), employee.getEmail(), employee.getPhone(),
            employee.getPosition(), employee.getDepartment(), employee.getHireDate(),
            employee.getSalary(), employee.getStatus(), employee.getManager(),
            employee.getAddress(), employee.getEmergencyContactName(),
            employee.getEmergencyContactPhone(), employee.getEmergencyContactRelationship(),
            employee.getCreatedAt(), employee.getUpdatedAt());
        
        return employee;
    }

    private Employee update(Employee employee) {
        String sql = """
            UPDATE employees SET name = ?, email = ?, phone = ?, position = ?, 
                               department = ?, hire_date = ?, salary = ?, status = ?, 
                               manager = ?, address = ?, emergency_contact_name = ?, 
                               emergency_contact_phone = ?, emergency_contact_relationship = ?, 
                               updated_at = ?
            WHERE id = ?
            """;
        
        jdbcTemplate.update(sql,
            employee.getName(), employee.getEmail(), employee.getPhone(),
            employee.getPosition(), employee.getDepartment(), employee.getHireDate(),
            employee.getSalary(), employee.getStatus(), employee.getManager(),
            employee.getAddress(), employee.getEmergencyContactName(),
            employee.getEmergencyContactPhone(), employee.getEmergencyContactRelationship(),
            LocalDateTime.now(), employee.getId());
        
        return employee;
    }

    public void deleteById(String id) {
        String sql = "DELETE FROM employees WHERE id = ?";
        jdbcTemplate.update(sql, id);
    }

    public List<Employee> findByDepartment(String department) {
        String sql = "SELECT * FROM employees WHERE department = ? ORDER BY name";
        return jdbcTemplate.query(sql, employeeRowMapper, department);
    }

    public List<Employee> findByStatus(String status) {
        String sql = "SELECT * FROM employees WHERE status = ? ORDER BY name";
        return jdbcTemplate.query(sql, employeeRowMapper, status);
    }

    public List<Employee> searchByNameOrEmail(String searchTerm) {
        String sql = "SELECT * FROM employees WHERE LOWER(name) LIKE ? OR LOWER(email) LIKE ? ORDER BY name";
        String searchPattern = "%" + searchTerm.toLowerCase() + "%";
        return jdbcTemplate.query(sql, employeeRowMapper, searchPattern, searchPattern);
    }

    private static class EmployeeRowMapper implements RowMapper<Employee> {
        @Override
        public Employee mapRow(ResultSet rs, int rowNum) throws SQLException {
            Employee employee = new Employee();
            employee.setId(rs.getString("id"));
            employee.setName(rs.getString("name"));
            employee.setEmail(rs.getString("email"));
            employee.setPhone(rs.getString("phone"));
            employee.setPosition(rs.getString("position"));
            employee.setDepartment(rs.getString("department"));
            employee.setHireDate(rs.getDate("hire_date").toLocalDate());
            employee.setSalary(rs.getBigDecimal("salary"));
            employee.setStatus(rs.getString("status"));
            employee.setManager(rs.getString("manager"));
            employee.setAddress(rs.getString("address"));
            employee.setEmergencyContactName(rs.getString("emergency_contact_name"));
            employee.setEmergencyContactPhone(rs.getString("emergency_contact_phone"));
            employee.setEmergencyContactRelationship(rs.getString("emergency_contact_relationship"));
            employee.setCreatedAt(rs.getTimestamp("created_at").toLocalDateTime());
            employee.setUpdatedAt(rs.getTimestamp("updated_at").toLocalDateTime());
            return employee;
        }
    }
}