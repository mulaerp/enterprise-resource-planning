package com.mulaerp.shop.service;

import com.mulaerp.member.repository.MemberRepository;
import com.mulaerp.shop.dto.ShopCustomerDto;
import com.mulaerp.shop.dto.ShopLoginRequest;
import com.mulaerp.shop.dto.ShopRegisterRequest;
import com.mulaerp.shop.entity.ShopCustomer;
import com.mulaerp.shop.repository.ShopCustomerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Registration/login/session-lookup for the B2C storefront customer identity - completely
 * decoupled from {@code com.mulaerp.auth.service.AuthService} (staff). Deliberately does NOT go
 * through Spring's {@code AuthenticationManager}/{@code UserDetailsService} (that stack is wired
 * to {@code UserRepository} only, see {@code CustomUserDetailsService}) - password checking here
 * is a direct {@code PasswordEncoder.matches} call against {@code ShopCustomerRepository}, so
 * there is no shared authentication path a shop login could accidentally ride through the staff
 * one, or vice versa.
 */
@Service
@RequiredArgsConstructor
public class ShopAuthService {

    private final ShopCustomerRepository shopCustomerRepository;
    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public ShopCustomerDto register(ShopRegisterRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        if (shopCustomerRepository.existsByEmail(email)) {
            throw new IllegalStateException("An account with this email already exists");
        }

        ShopCustomer customer = new ShopCustomer();
        customer.setEmail(email);
        customer.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        customer.setFullName(request.getFullName());
        customer.setPhone(request.getPhone());
        customer.setEmailVerified(false);
        customer.setStatus(ShopCustomer.ShopCustomerStatus.ACTIVE);

        // OWNER DECISION (auto-link, do not merge anything else): if the registering email
        // matches an existing loyalty member's email, link member_id so their points/store
        // credit carry over to the new web account. Member has no unique constraint on email
        // (phone is the unique loyalty key), so this takes the first match on a non-deleted
        // member - existing seed/demo data never has two members sharing an email.
        memberRepository.findByEmailIgnoreCaseAndDeletedFalse(email)
                .ifPresent(member -> customer.setMemberId(member.getId()));

        ShopCustomer saved = shopCustomerRepository.save(customer);
        return ShopCustomerDto.fromEntity(saved);
    }

    @Transactional
    public ShopCustomerDto login(ShopLoginRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        ShopCustomer customer = shopCustomerRepository.findByEmailAndDeletedFalse(email)
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), customer.getPasswordHash())) {
            throw new BadCredentialsException("Invalid email or password");
        }
        if (customer.getStatus() == ShopCustomer.ShopCustomerStatus.SUSPENDED) {
            throw new BadCredentialsException("This account has been suspended");
        }

        return ShopCustomerDto.fromEntity(customer);
    }

    @Transactional(readOnly = true)
    public Optional<ShopCustomerDto> findActiveByEmail(String email) {
        return shopCustomerRepository.findByEmailAndDeletedFalse(email)
                .filter(c -> c.getStatus() == ShopCustomer.ShopCustomerStatus.ACTIVE)
                .map(ShopCustomerDto::fromEntity);
    }
}
