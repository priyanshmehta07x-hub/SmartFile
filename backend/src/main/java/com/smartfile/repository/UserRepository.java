package com.smartfile.repository;

import com.smartfile.entity.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByEmail(String email);

    Optional<AppUser> findFirstByRoleOrderByIdAsc(String role);

    List<AppUser> findAllByRoleOrderByFullNameAsc(String role);
}
