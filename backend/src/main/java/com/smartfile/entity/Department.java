package com.smartfile.entity;
import jakarta.persistence.*;
@Entity @Table(name="departments") public class Department { @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id; @Column(nullable=false,unique=true) public String name; public Department(){} public Department(String n){name=n;} }
