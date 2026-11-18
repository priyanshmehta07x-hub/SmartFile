package com.smartfile.repository;

import com.smartfile.entity.SmartApplication;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ApplicationRepository extends JpaRepository<SmartApplication, Long> {
    List<SmartApplication> findAllByOwner_IdOrderBySubmittedAtDesc(Long ownerId);

    List<SmartApplication> findAllByAssignedOfficerEmailOrderBySubmittedAtDesc(String assignedOfficerEmail);

    Optional<SmartApplication> findByFileId(String fileId);

    Optional<SmartApplication> findByFileIdAndOwner_Id(String fileId, Long ownerId);

    Optional<SmartApplication> findByFileIdAndAssignedOfficerEmail(String fileId, String assignedOfficerEmail);
}
