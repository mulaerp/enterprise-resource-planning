package com.mulaerp.member.service;

import com.mulaerp.common.exception.ResourceNotFoundException;
import com.mulaerp.member.dto.CreateMemberRequest;
import com.mulaerp.member.dto.MemberDto;
import com.mulaerp.member.dto.UpdateMemberRequest;
import com.mulaerp.member.entity.Member;
import com.mulaerp.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class MemberService {

    // Tier thresholds/discounts - contract: points >= 500 -> SILVER (5%), >= 2000 -> GOLD (10%).
    private static final int SILVER_THRESHOLD = 500;
    private static final int GOLD_THRESHOLD = 2000;
    private static final BigDecimal SILVER_DISCOUNT = BigDecimal.valueOf(5);
    private static final BigDecimal GOLD_DISCOUNT = BigDecimal.valueOf(10);

    private final MemberRepository memberRepository;

    @Transactional(readOnly = true)
    public Page<MemberDto> getAllMembers(String search, Pageable pageable) {
        Page<Member> page = (search != null && !search.isBlank())
                ? memberRepository.searchMembers(search, pageable)
                : memberRepository.findByDeletedFalse(pageable);
        return page.map(this::toDto);
    }

    @Transactional(readOnly = true)
    public MemberDto getMemberById(UUID id) {
        return toDto(getEntity(id));
    }

    /** Used by PosSaleService to read the member's current discountPercent for a sale. */
    @Transactional(readOnly = true)
    public Member getEntity(UUID id) {
        return memberRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Member not found: " + id));
    }

    @Transactional
    public MemberDto createMember(CreateMemberRequest request) {
        if (memberRepository.existsByPhoneAndDeletedFalse(request.getPhone())) {
            throw new IllegalStateException("Member with phone " + request.getPhone() + " already exists");
        }

        Member member = new Member();
        member.setCode(generateCode());
        member.setName(request.getName());
        member.setPhone(request.getPhone());
        member.setEmail(request.getEmail());
        member.setPoints(0);
        member.setTier("BASIC");
        member.setDiscountPercent(BigDecimal.ZERO);

        return toDto(memberRepository.save(member));
    }

    @Transactional
    public MemberDto updateMember(UUID id, UpdateMemberRequest request) {
        Member member = getEntity(id);

        if (!member.getPhone().equals(request.getPhone())
                && memberRepository.existsByPhoneAndDeletedFalse(request.getPhone())) {
            throw new IllegalStateException("Member with phone " + request.getPhone() + " already exists");
        }

        member.setName(request.getName());
        member.setPhone(request.getPhone());
        member.setEmail(request.getEmail());

        return toDto(memberRepository.save(member));
    }

    /**
     * Applies points earned from a PoS sale and recomputes tier/discountPercent. Called by
     * PosSaleService within the same sale-creation transaction.
     */
    @Transactional
    public MemberDto accruePoints(UUID memberId, int pointsToAdd) {
        Member member = getEntity(memberId);
        member.setPoints(member.getPoints() + pointsToAdd);
        recomputeTier(member);
        return toDto(memberRepository.save(member));
    }

    /**
     * V34: reverses points accrued from a voided PoS sale. Clamped at zero rather than allowed to
     * go negative - a member's points balance is never a debt, so a void can only ever bring it
     * back down to (not below) where it would have been had the sale never happened; recomputes
     * tier the same way accruePoints does.
     */
    @Transactional
    public MemberDto deductPoints(UUID memberId, int pointsToDeduct) {
        Member member = getEntity(memberId);
        int newPoints = Math.max(0, member.getPoints() - pointsToDeduct);
        member.setPoints(newPoints);
        recomputeTier(member);
        return toDto(memberRepository.save(member));
    }

    /**
     * WP: grants store credit to a member (e.g. a STORE_CREDIT trade-in payout). Locks the member
     * row (PESSIMISTIC_WRITE) for the duration of this transaction so a concurrent credit/debit on
     * the same member serializes rather than both reading the same stale balance.
     */
    @Transactional
    public MemberDto creditStoreCredit(UUID memberId, BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Store credit amount must be positive");
        }
        Member member = lockEntity(memberId);
        member.setStoreCreditBalance(member.getStoreCreditBalance().add(amount));
        return toDto(memberRepository.save(member));
    }

    /**
     * WP: redeems store credit against a sale. Rejects (400, IllegalArgumentException) an attempt
     * to redeem more than the member's current balance - the authoritative overdraft guard; any
     * caller-side "don't ask for more than the sale needs" clamping happens before this call, but
     * this is what actually protects the balance from going negative under concurrency.
     */
    @Transactional
    public MemberDto debitStoreCredit(UUID memberId, BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Store credit amount must be positive");
        }
        Member member = lockEntity(memberId);
        if (member.getStoreCreditBalance().compareTo(amount) < 0) {
            throw new IllegalArgumentException(String.format(
                    "Insufficient store credit balance for member %s: available %s, requested %s",
                    member.getCode(), member.getStoreCreditBalance(), amount));
        }
        member.setStoreCreditBalance(member.getStoreCreditBalance().subtract(amount));
        return toDto(memberRepository.save(member));
    }

    private Member lockEntity(UUID id) {
        return memberRepository.findByIdAndDeletedFalseForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Member not found: " + id));
    }

    private void recomputeTier(Member member) {
        int points = member.getPoints();
        if (points >= GOLD_THRESHOLD) {
            member.setTier("GOLD");
            member.setDiscountPercent(GOLD_DISCOUNT);
        } else if (points >= SILVER_THRESHOLD) {
            member.setTier("SILVER");
            member.setDiscountPercent(SILVER_DISCOUNT);
        } else {
            member.setTier("BASIC");
            member.setDiscountPercent(BigDecimal.ZERO);
        }
    }

    // count()-based sequence has no locking, so two concurrent member creations can read the
    // same count and produce the same code - append a random hex suffix so the code is unique
    // by construction even when that race happens.
    private String generateCode() {
        long count = memberRepository.count() + 1;
        String suffix = String.format("%04x", ThreadLocalRandom.current().nextInt(0x10000));
        return "MBR-" + String.format("%04d", count) + "-" + suffix;
    }

    private MemberDto toDto(Member member) {
        MemberDto dto = new MemberDto();
        dto.setId(member.getId());
        dto.setCode(member.getCode());
        dto.setName(member.getName());
        dto.setPhone(member.getPhone());
        dto.setEmail(member.getEmail());
        dto.setPoints(member.getPoints());
        dto.setTier(member.getTier());
        dto.setDiscountPercent(member.getDiscountPercent());
        dto.setStoreCreditBalance(member.getStoreCreditBalance());
        dto.setCreatedAt(member.getCreatedAt());
        dto.setUpdatedAt(member.getUpdatedAt());
        return dto;
    }
}
