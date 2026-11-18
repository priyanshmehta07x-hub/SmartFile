package com.smartfile.repository;

import com.smartfile.entity.Complaint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ComplaintRepository extends JpaRepository<Complaint, Long> {
    List<Complaint> findAllByOwner_IdOrderByCreatedAtDesc(Long ownerId);
}
