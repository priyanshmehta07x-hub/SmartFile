package com.smartfile.repository;

import com.smartfile.entity.WorkflowAction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WorkflowActionRepository extends JpaRepository<WorkflowAction, Long> {
    List<WorkflowAction> findByApplicationFileIdOrderByCreatedAtAscIdAsc(String fileId);

    List<WorkflowAction> findByApplication_Owner_IdOrderByCreatedAtDesc(Long ownerId);

    List<WorkflowAction> findByApplication_AssignedOfficerEmailOrderByCreatedAtDesc(String assignedOfficerEmail);

    List<WorkflowAction> findAllByOrderByCreatedAtDesc();
}
