package com.smartfile.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "applications", indexes = {
        @Index(name = "idx_app_status", columnList = "status"),
        @Index(name = "idx_app_assigned_officer", columnList = "assignedOfficerEmail"),
        @Index(name = "idx_app_file_id", columnList = "fileId", unique = true)
})
public class SmartApplication {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false, unique = true)
    public String fileId;

    @Column(nullable = false)
    public String applicationType;

    @Column(nullable = false)
    public String applicantName;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id")
    public AppUser owner;

    @ManyToOne(fetch = FetchType.EAGER)
    public Department department;

    @Column(nullable = false)
    public String status = "Submitted";

    public String priority = "Normal";
    public String assignedOfficer;
    public String assignedOfficerRole;
    @JsonIgnore
    public String assignedOfficerEmail;
    public Instant submittedAt;
    public Instant updatedAt;
    public Instant deadline;
    public String currentStage = "Clerk verification";

    public SmartApplication() {
    }

    @PrePersist
    void setCreationTimes() {
        Instant now = Instant.now();
        if (submittedAt == null) {
            submittedAt = now;
        }
        if (updatedAt == null) {
            updatedAt = submittedAt;
        }
    }

    @PreUpdate
    void setUpdatedTime() {
        updatedAt = Instant.now();
    }
}
