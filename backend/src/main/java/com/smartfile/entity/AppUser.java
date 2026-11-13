package com.smartfile.entity;
import jakarta.persistence.*;import java.time.Instant;
@Entity @Table(name="users") public class AppUser { @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id; @Column(nullable=false,unique=true) public String email; @Column(nullable=false) public String passwordHash; @Column(nullable=false) public String role; public String fullName; public Instant createdAt=Instant.now(); public AppUser(){} }
