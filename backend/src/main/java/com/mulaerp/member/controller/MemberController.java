package com.mulaerp.member.controller;

import com.mulaerp.member.dto.CreateMemberRequest;
import com.mulaerp.member.dto.MemberDto;
import com.mulaerp.member.dto.UpdateMemberRequest;
import com.mulaerp.member.service.MemberService;
import com.mulaerp.auth.security.RoleRules;
import com.mulaerp.util.PageSizeCap;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

// WP: five-role model - CASHIER may CREATE a walk-in member (RoleRules.CUSTOMER_MEMBER_CREATE) but
// not update (RoleRules.MANAGER_UP, unchanged from before); GET stays open to any authenticated user.
@RestController
@RequestMapping("/api/v1/members")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    @GetMapping
    public ResponseEntity<Page<MemberDto>> getAllMembers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search
    ) {
        Pageable pageable = PageRequest.of(page, PageSizeCap.cap(size), Sort.by("name").ascending());
        return ResponseEntity.ok(memberService.getAllMembers(search, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<MemberDto> getMemberById(@PathVariable UUID id) {
        return ResponseEntity.ok(memberService.getMemberById(id));
    }

    @PostMapping
    @PreAuthorize(RoleRules.CUSTOMER_MEMBER_CREATE)
    public ResponseEntity<MemberDto> createMember(@Valid @RequestBody CreateMemberRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(memberService.createMember(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize(RoleRules.MANAGER_UP)
    public ResponseEntity<MemberDto> updateMember(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateMemberRequest request
    ) {
        return ResponseEntity.ok(memberService.updateMember(id, request));
    }
}
