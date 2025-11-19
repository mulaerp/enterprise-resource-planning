package com.mulaerp.auth.service;

import com.mulaerp.auth.dto.LoginRequest;
import com.mulaerp.auth.dto.LoginResponse;
import com.mulaerp.auth.entity.User;
import com.mulaerp.auth.repository.UserRepository;
import com.mulaerp.auth.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit Tests for AuthService
 * Phase 5.3: Testing
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private AuthenticationManager authenticationManager;

    @InjectMocks
    private AuthService authService;

    private User testUser;
    private LoginRequest loginRequest;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId(UUID.randomUUID());
        testUser.setEmail("test@mulaerp.com");
        testUser.setPasswordHash("$2a$10$hashedpassword");
        testUser.setFullName("Test User");
        testUser.setRole(User.UserRole.USER);
        testUser.setStatus(User.UserStatus.ACTIVE);

        loginRequest = new LoginRequest();
        loginRequest.setEmail("test@mulaerp.com");
        loginRequest.setPassword("password123");
    }

    @Test
    void testLogin_Success() {
        // Arrange
        Authentication authentication = mock(Authentication.class);
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(authentication);
        when(userRepository.findByEmailAndDeletedFalse(loginRequest.getEmail()))
                .thenReturn(Optional.of(testUser));
        when(jwtUtil.generateToken(testUser.getEmail(), testUser.getId(), testUser.getRole().name()))
                .thenReturn("mock-jwt-token");

        // Act
        LoginResponse response = authService.login(loginRequest);

        // Assert
        assertNotNull(response);
        assertEquals("mock-jwt-token", response.getToken());
        assertNotNull(response.getUser());
        assertEquals("test@mulaerp.com", response.getUser().getEmail());
        assertEquals("Test User", response.getUser().getFullName());
        
        verify(authenticationManager, times(1)).authenticate(any(UsernamePasswordAuthenticationToken.class));
        verify(userRepository, times(1)).findByEmailAndDeletedFalse(loginRequest.getEmail());
        verify(jwtUtil, times(1)).generateToken(anyString(), any(UUID.class), anyString());
    }

    @Test
    void testLogin_InvalidCredentials() {
        // Arrange
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenThrow(new BadCredentialsException("Invalid credentials"));

        // Act & Assert
        assertThrows(BadCredentialsException.class, () -> authService.login(loginRequest));
        
        verify(authenticationManager, times(1)).authenticate(any(UsernamePasswordAuthenticationToken.class));
        verify(userRepository, never()).findByEmailAndDeletedFalse(any());
        verify(jwtUtil, never()).generateToken(anyString(), any(), anyString());
    }

    @Test
    void testLogin_UserNotFound() {
        // Arrange
        Authentication authentication = mock(Authentication.class);
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(authentication);
        when(userRepository.findByEmailAndDeletedFalse(loginRequest.getEmail()))
                .thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(RuntimeException.class, () -> authService.login(loginRequest));
        
        verify(authenticationManager, times(1)).authenticate(any(UsernamePasswordAuthenticationToken.class));
        verify(userRepository, times(1)).findByEmailAndDeletedFalse(loginRequest.getEmail());
        verify(jwtUtil, never()).generateToken(anyString(), any(), anyString());
    }
}
