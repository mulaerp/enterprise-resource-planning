package com.mulaerp.publicapi.service;

import com.mulaerp.publicapi.dto.PublicRepairDto;
import com.mulaerp.repair.entity.RepairJob;
import com.mulaerp.repair.repository.RepairJobRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * PUBLIC-API: anonymous (permitAll) repair status lookup by jobNumber - mirrors
 * PublicWarrantyService's always-200 {found:...} contract, never a 404 for an unknown code.
 */
@Service
@RequiredArgsConstructor
public class PublicRepairService {

    private final RepairJobRepository repairJobRepository;

    @Transactional(readOnly = true)
    public PublicRepairDto lookup(String jobNumber) {
        if (jobNumber == null || jobNumber.isBlank()) {
            return PublicRepairDto.notFound();
        }

        Optional<RepairJob> job = repairJobRepository.findByJobNumberAndDeletedFalse(jobNumber.trim());
        return job.map(this::toDto).orElseGet(PublicRepairDto::notFound);
    }

    private PublicRepairDto toDto(RepairJob job) {
        return new PublicRepairDto(
                true,
                job.getJobNumber(),
                job.getStatus().name(),
                job.getPromisedDate(),
                job.getQuoteAmount(),
                job.getStatus() == RepairJob.RepairStatus.AWAITING_APPROVAL
        );
    }
}
