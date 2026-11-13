package com.smartfile.entity;
import jakarta.persistence.*;import java.time.Instant;
@Entity @Table(name="complaints") public class Complaint {@Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;@Column(nullable=false,unique=true) public String complaintId;@Column(nullable=false) public String applicantName;public String category;@Column(length=2000) public String description;public String status="Open";public String assignedTo;public String response;public Instant createdAt=Instant.now();public Complaint(){} }
