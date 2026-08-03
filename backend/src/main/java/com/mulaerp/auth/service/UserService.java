package com.mulaerp.auth.service;

import com.mulaerp.auth.dto.CreateUserRequest;
import com.mulaerp.auth.dto.UpdateUserRequest;
import com.mulaerp.auth.dto.UserDTO;
import com.mulaerp.auth.entity.User;
import com.mulaerp.auth.repository.UserRepository;
import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.email.service.EmailTemplateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailTemplateService emailTemplateService;

    // NOTE: intentionally not @Cacheable - RedisCacheManager's Jackson serializer (see
    // CacheConfig) cannot deserialize org.springframework.data.domain.PageImpl (no default
    // constructor/Creator), so caching a Page<> here 500s on every read. See getUserById
    // below for the same pattern applied safely to a single-entity (non-Page) DTO.
    @Transactional(readOnly = true)
    public Page<UserDTO> getAllUsers(Pageable pageable) {
        return userRepository.findAll(pageable).map(this::convertToDTO);
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "user", key = "#id")
    public UserDTO getUserById(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return convertToDTO(user);
    }

    @Transactional
    @CacheEvict(value = {"users", "user"}, allEntries = true)
    public UserDTO createUser(CreateUserRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new IllegalArgumentException("Email already exists");
        }

        User user = new User();
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setFullName(request.getFullName());
        user.setRole(request.getRole() != null ? request.getRole() : User.UserRole.CASHIER);
        user.setStatus(User.UserStatus.ACTIVE);

        User saved = userRepository.save(user);

        // Send welcome/registration email with the temporary password (WP2)
        sendUserRegistrationEmail(saved, request.getPassword());

        return convertToDTO(saved);
    }

    private void sendUserRegistrationEmail(User user, String tempPassword) {
        try {
            emailTemplateService.sendUserRegistration(
                    user.getEmail(),
                    user.getFullName(),
                    user.getRole().name(),
                    tempPassword
            );
        } catch (Exception e) {
            log.warn("Failed to send registration email to {}: {}", user.getEmail(), e.getMessage());
        }
    }

    @Transactional
    @CacheEvict(value = {"users", "user"}, allEntries = true)
    public UserDTO updateUser(UUID id, UpdateUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!user.getEmail().equals(request.getEmail())) {
            if (userRepository.findByEmail(request.getEmail()).isPresent()) {
                throw new IllegalArgumentException("Email already exists");
            }
            user.setEmail(request.getEmail());
        }

        user.setFullName(request.getFullName());
        if (request.getRole() != null) {
            user.setRole(request.getRole());
        }
        if (request.getStatus() != null) {
            user.setStatus(request.getStatus());
        }

        User updated = userRepository.save(user);
        return convertToDTO(updated);
    }

    @Transactional
    @CacheEvict(value = {"users", "user"}, allEntries = true)
    public void deleteUser(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        userRepository.delete(user);
    }

    private UserDTO convertToDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setEmail(user.getEmail());
        dto.setFullName(user.getFullName());
        dto.setRole(user.getRole().name());
        dto.setStatus(user.getStatus().name());
        dto.setCompanyId(null);
        dto.setCreatedAt(user.getCreatedAt());
        dto.setUpdatedAt(user.getUpdatedAt());
        return dto;
    }
}
