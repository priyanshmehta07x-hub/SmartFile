package com.smartfile.controller;

import com.smartfile.entity.AppUser;
import com.smartfile.entity.Complaint;
import com.smartfile.entity.Department;
import com.smartfile.entity.SmartApplication;
import com.smartfile.entity.WorkflowAction;
import com.smartfile.repository.ApplicationRepository;
import com.smartfile.repository.ComplaintRepository;
import com.smartfile.repository.DepartmentRepository;
import com.smartfile.repository.UserRepository;
import com.smartfile.repository.WorkflowActionRepository;
import com.smartfile.security.JwtService;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final UserRepository users;
    private final DepartmentRepository departments;
    private final ApplicationRepository apps;
    private final WorkflowActionRepository actions;
    private final ComplaintRepository complaints;
    private final PasswordEncoder passwords;
    private final JwtService jwt;

    public ApiController(
            UserRepository users,
            DepartmentRepository departments,
            ApplicationRepository apps,
            WorkflowActionRepository actions,
            ComplaintRepository complaints,
            PasswordEncoder passwords,
            JwtService jwt) {
        this.users = users;
        this.departments = departments;
        this.apps = apps;
        this.actions = actions;
        this.complaints = complaints;
        this.passwords = passwords;
        this.jwt = jwt;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of(
                "status", "UP",
                "service", "SmartFile API",
                "serverTimeUtc", Instant.now().toString());
    }

    @GetMapping("/departments")
    public List<Department> departmentList() {
        return departments.findAll();
    }

    @GetMapping("/officers")
    public ResponseEntity<?> officerList(java.security.Principal principal) {
        AppUser user = users.findByEmail(principal.getName()).orElseThrow();
        if (!"CLERK".equals(user.role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Only Clerks can view the Officer directory"));
        }
        return ResponseEntity.ok(users.findAllByRoleOrderByFullNameAsc("OFFICER").stream()
                .map(officer -> Map.of("name", officer.fullName, "email", officer.email))
                .toList());
    }

    @GetMapping("/audit")
    public List<WorkflowAction> auditLog(java.security.Principal principal) {
        AppUser user = users.findByEmail(principal.getName()).orElseThrow();
        if (user.role.equals("CITIZEN")) {
            return actions.findByApplication_Owner_IdOrderByCreatedAtDesc(user.id);
        }
        if (user.role.equals("OFFICER")) {
            return actions.findByApplication_AssignedOfficerEmailOrderByCreatedAtDesc(user.email);
        }
        return actions.findAllByOrderByCreatedAtDesc();
    }

    @PostMapping("/auth/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String email = Objects.requireNonNullElse(body.get("email"), "").trim().toLowerCase(Locale.ROOT);
        String password = Objects.requireNonNullElse(body.get("password"), "");
        AppUser user = users.findByEmail(email).orElse(null);
        if (user == null || !passwords.matches(password, user.passwordHash)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid email or password"));
        }
        return ResponseEntity.ok(Map.of(
                "token", jwt.issue(user.email, user.role),
                "email", user.email,
                "role", user.role,
                "name", user.fullName));
    }

    @GetMapping("/applications")
    public List<SmartApplication> list(java.security.Principal principal) {
        AppUser user = users.findByEmail(principal.getName()).orElseThrow();
        if (user.role.equals("CITIZEN")) {
            return apps.findAllByOwner_IdOrderBySubmittedAtDesc(user.id);
        }
        if (user.role.equals("OFFICER")) {
            return apps.findAllByAssignedOfficerEmailOrderBySubmittedAtDesc(user.email);
        }
        return apps.findAll();
    }

    @GetMapping("/applications/{fileId}")
    public ResponseEntity<?> get(@PathVariable String fileId, java.security.Principal principal) {
        AppUser user = users.findByEmail(principal.getName()).orElseThrow();
        SmartApplication application = findVisibleApplication(fileId, user).orElse(null);
        if (application == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(application);
    }

    @PostMapping("/applications")
    @Transactional
    public ResponseEntity<?> create(
            @RequestBody Map<String, String> body,
            java.security.Principal principal) {
        String type = body.get("applicationType");
        String name = body.get("applicantName");
        if (type == null || type.isBlank() || name == null || name.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "applicationType and applicantName are required"));
        }
        if (type.length() > 120 || name.length() > 120) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Application type and applicant name must be 120 characters or fewer"));
        }
        AppUser user = users.findByEmail(principal.getName()).orElseThrow();
        if (user.role.equals("CITIZEN") && !user.fullName.equalsIgnoreCase(name.trim())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Applicants may only submit applications for their own account"));
        }

        String departmentName = Objects.requireNonNullElse(body.get("department"), "Education").trim();
        if (departmentName.isBlank() || departmentName.length() > 120) {
            return ResponseEntity.badRequest().body(Map.of("error", "department is required"));
        }
        String priority = Objects.requireNonNullElse(body.get("priority"), "Normal").trim();
        if (!Set.of("Low", "Normal", "High").contains(priority)) {
            return ResponseEntity.badRequest().body(Map.of("error", "priority must be Low, Normal, or High"));
        }
        Department department = departments.findByNameIgnoreCase(departmentName)
                .orElseGet(() -> departments.save(new Department(departmentName)));
        Instant submittedAt = Instant.now();
        SmartApplication application = new SmartApplication();
        application.applicationType = type.trim();
        application.applicantName = name.trim();
        if (user.role.equals("CITIZEN")) {
            application.owner = user;
        }
        application.department = department;
        application.priority = priority;
        application.fileId = nextId();
        application.submittedAt = submittedAt;
        application.deadline = submittedAt.plusSeconds(172800);
        AppUser clerk = users.findFirstByRoleOrderByIdAsc("CLERK")
                .orElseThrow(() -> new IllegalStateException("No Clerk account is configured"));
        application.status = "Under Review by Clerk";
        application.currentStage = "Under Review by Clerk";
        assignHandler(application, clerk);
        apps.save(application);
        actions.save(new WorkflowAction(application, principal.getName(), "SUBMITTED", "Application received"));
        actions.save(new WorkflowAction(application, "system@smartfile.demo", "ASSIGNED_TO_CLERK", "File assigned to Clerk review"));
        return ResponseEntity.status(HttpStatus.CREATED).body(application);
    }

    @PutMapping("/applications/{fileId}")
    @Transactional
    public ResponseEntity<?> update(
            @PathVariable String fileId,
            @RequestBody Map<String, String> body,
            java.security.Principal principal) {
        AppUser user = users.findByEmail(principal.getName()).orElseThrow();
        SmartApplication application = findVisibleApplication(fileId, user).orElse(null);
        if (application == null) return ResponseEntity.notFound().build();
        if (!Set.of("Submitted", "Returned").contains(application.status)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Only submitted or returned applications can be edited"));
        }

        String type = Objects.requireNonNullElse(body.get("applicationType"), "").trim();
        String name = Objects.requireNonNullElse(body.get("applicantName"), "").trim();
        String departmentName = Objects.requireNonNullElse(body.get("department"), "").trim();
        String priority = Objects.requireNonNullElse(body.get("priority"), "").trim();
        if (type.isBlank() || name.isBlank() || departmentName.isBlank()
                || !Set.of("Low", "Normal", "High").contains(priority)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Valid application details are required"));
        }
        if (type.length() > 120 || name.length() > 120) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Application type and applicant name must be 120 characters or fewer"));
        }
        if (user.role.equals("CITIZEN") && !user.fullName.equalsIgnoreCase(name)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Applicants may only keep their own account name on the application"));
        }

        Department department = departments.findByNameIgnoreCase(departmentName).orElse(null);
        if (department == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Unknown department"));
        }
        application.applicationType = type;
        application.applicantName = name;
        application.department = department;
        application.priority = priority;
        if (application.status.equals("Returned")) {
            AppUser clerk = users.findFirstByRoleOrderByIdAsc("CLERK")
                    .orElseThrow(() -> new IllegalStateException("No Clerk account is configured"));
            application.status = "Under Review by Clerk";
            application.currentStage = "Under Review by Clerk";
            assignHandler(application, clerk);
            actions.save(new WorkflowAction(
                    application, principal.getName(), "CITIZEN_RESUBMITTED", "Updated application resubmitted"));
            actions.save(new WorkflowAction(
                    application, "system@smartfile.demo", "ASSIGNED_TO_CLERK", "File returned to Clerk review"));
        } else {
            actions.save(new WorkflowAction(application, principal.getName(), "UPDATED", "Application details updated"));
        }
        apps.save(application);
        return ResponseEntity.ok(application);
    }

    @DeleteMapping("/applications/{fileId}")
    @Transactional
    public ResponseEntity<?> cancel(
            @PathVariable String fileId,
            java.security.Principal principal) {
        AppUser user = users.findByEmail(principal.getName()).orElseThrow();
        SmartApplication application = findVisibleApplication(fileId, user).orElse(null);
        if (application == null) return ResponseEntity.notFound().build();
        if (!Set.of("Submitted", "Returned").contains(application.status)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Only submitted or returned applications can be cancelled"));
        }
        application.status = "Cancelled";
        application.currentStage = "Cancelled";
        apps.save(application);
        actions.save(new WorkflowAction(application, principal.getName(), "CANCELLED", "Application cancelled"));
        return ResponseEntity.ok(application);
    }

    @PostMapping("/applications/{fileId}/actions")
    @Transactional
    public ResponseEntity<?> action(
            @PathVariable String fileId,
            @RequestBody Map<String, String> body,
            java.security.Principal principal) {
        AppUser user = users.findByEmail(principal.getName()).orElseThrow();
        if (!Set.of("CLERK", "OFFICER").contains(user.role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "This role cannot process workflow actions"));
        }
        SmartApplication application = findVisibleApplication(fileId, user).orElse(null);
        if (application == null) {
            return ResponseEntity.notFound().build();
        }
        if (Set.of(
                "Final Approved by Officer", "Rejected by Clerk", "Rejected by Officer",
                "Approved", "Rejected", "Cancelled").contains(application.status)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "This application has already been completed"));
        }
        String action = Objects.requireNonNullElse(body.get("action"), "").trim().toUpperCase(Locale.ROOT);
        String remarks = Objects.requireNonNullElse(body.get("remarks"), "").trim();
        String assignedOfficerEmail = Objects.requireNonNullElse(body.get("assignedOfficerEmail"), "")
                .trim().toLowerCase(Locale.ROOT);
        if (user.role.equals("CLERK")) {
            if (!Set.of(
                    "Submitted", "Under Review by Clerk", "Verified by Clerk",
                    "Returned", "Documents requested")
                    .contains(application.status)) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(Map.of("error", "This application is no longer waiting for Clerk review"));
            }
            if (!Set.of("VERIFY", "FORWARD", "REJECT", "RETURN", "REQUEST_DOCUMENTS").contains(action)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Unsupported Clerk workflow action"));
            }
            if ((action.equals("REJECT") || action.equals("RETURN")) && remarks.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "A reason is required"));
            }
            if (action.equals("FORWARD") && !application.status.equals("Verified by Clerk")) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(Map.of("error", "The application must be verified before forwarding to an Officer"));
            }
            if (action.equals("VERIFY") && application.status.equals("Verified by Clerk")) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(Map.of("error", "This application has already been verified by the Clerk"));
            }
            switch (action) {
                case "VERIFY" -> {
                    application.status = "Verified by Clerk";
                    application.currentStage = "Verified by Clerk";
                    assignHandler(application, user);
                    actions.save(new WorkflowAction(application, principal.getName(), "CLERK_VERIFIED", remarks));
                }
                case "FORWARD" -> {
                    AppUser officer = users.findByEmail(assignedOfficerEmail)
                            .filter(candidate -> "OFFICER".equals(candidate.role))
                            .orElse(null);
                    if (officer == null) {
                        return ResponseEntity.badRequest()
                                .body(Map.of("error", "Select an available Officer to receive this application"));
                    }
                    application.status = "Pending with Officer";
                    application.currentStage = "Pending with Officer";
                    assignHandler(application, officer);
                    actions.save(new WorkflowAction(
                            application, principal.getName(), "FORWARDED_TO_OFFICER",
                            "Forwarded to Officer " + officer.fullName
                                    + (remarks.isBlank() ? "" : ". " + remarks)));
                    actions.save(new WorkflowAction(
                            application, "system@smartfile.demo", "ASSIGNED_TO_OFFICER",
                            "File assigned to " + officer.fullName));
                }
                case "REJECT" -> {
                    application.status = "Rejected by Clerk";
                    application.currentStage = "Rejected by Clerk";
                    clearHandler(application);
                    actions.save(new WorkflowAction(application, principal.getName(), "CLERK_REJECTED", remarks));
                }
                case "RETURN" -> {
                    application.status = "Returned";
                    application.currentStage = "Returned to Citizen";
                    clearHandler(application);
                    actions.save(new WorkflowAction(application, principal.getName(), "RETURNED_TO_CITIZEN", remarks));
                }
                default -> {
                    application.status = "Documents requested";
                    application.currentStage = "Awaiting documents from Citizen";
                    clearHandler(application);
                    actions.save(new WorkflowAction(application, principal.getName(), "DOCUMENTS_REQUESTED", remarks));
                }
            }
        } else {
            if (!"OFFICER".equals(user.role)
                    || !user.email.equalsIgnoreCase(Objects.requireNonNullElse(application.assignedOfficerEmail, ""))) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Only the Officer assigned to this application may decide it"));
            }
            if (!application.status.equals("Pending with Officer")) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(Map.of("error", "Officer decision is available only after Clerk verification"));
            }
            if (!Set.of("FINAL_APPROVE", "REJECT").contains(action)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Officer may only approve or reject this application"));
            }
            if (action.equals("REJECT") && remarks.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "A reason is required"));
            }
            if (action.equals("FINAL_APPROVE")) {
                application.status = "Final Approved by Officer";
                application.currentStage = "Final Approved by Officer";
                actions.save(new WorkflowAction(application, principal.getName(), "OFFICER_FINAL_APPROVED", remarks));
            } else {
                application.status = "Rejected by Officer";
                application.currentStage = "Rejected by Officer";
                actions.save(new WorkflowAction(application, principal.getName(), "OFFICER_REJECTED", remarks));
            }
        }
        apps.save(application);
        return ResponseEntity.ok(application);
    }

    @GetMapping("/applications/{fileId}/history")
    public ResponseEntity<?> history(@PathVariable String fileId, java.security.Principal principal) {
        AppUser user = users.findByEmail(principal.getName()).orElseThrow();
        if (findVisibleApplication(fileId, user).isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(actions.findByApplicationFileIdOrderByCreatedAtAscIdAsc(fileId));
    }

    @GetMapping("/track/{fileId}")
    public ResponseEntity<?> track(@PathVariable String fileId, java.security.Principal principal) {
        AppUser user = users.findByEmail(principal.getName()).orElseThrow();
        SmartApplication application = findVisibleApplication(fileId, user).orElse(null);
        if (application == null) return ResponseEntity.notFound().build();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("fileId", application.fileId);
        result.put("applicationType", application.applicationType);
        result.put("applicantName", application.applicantName);
        result.put("department", application.department.name);
        result.put("status", application.status);
        result.put("submittedAt", application.submittedAt);
        result.put("updatedAt", application.updatedAt);
        result.put("deadline", application.deadline);
        result.put("currentStage", application.currentStage);
        result.put("assignedOfficer", application.assignedOfficer);
        result.put("assignedOfficerRole", application.assignedOfficerRole);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/complaints")
    public List<Complaint> complaintList(java.security.Principal principal) {
        AppUser user = users.findByEmail(principal.getName()).orElseThrow();
        if (user.role.equals("ADMIN")) {
            return complaints.findAll();
        }
        if (user.role.equals("CITIZEN")) {
            return complaints.findAllByOwner_IdOrderByCreatedAtDesc(user.id);
        }
        return complaints.findAll();
    }

    @PostMapping("/complaints")
    @Transactional
    public ResponseEntity<?> complaint(
            @RequestBody Map<String, String> body,
            java.security.Principal principal) {
        String category = Objects.requireNonNullElse(body.get("category"), "Other").trim();
        String name = body.get("applicantName");
        String description = Objects.requireNonNullElse(body.get("description"), "").trim();
        if (name == null || name.isBlank() || description.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "applicantName and description are required"));
        }
        if (name.length() > 120 || category.length() > 120 || description.length() > 2000) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Complaint fields exceed the allowed length"));
        }
        AppUser user = users.findByEmail(principal.getName()).orElseThrow();
        if (user.role.equals("CITIZEN") && !user.fullName.equalsIgnoreCase(name.trim())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "You may only file complaints for your account"));
        }
        Complaint complaint = new Complaint();
        complaint.complaintId = "CMP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        complaint.applicantName = name.trim();
        if (user.role.equals("CITIZEN")) {
            complaint.owner = user;
        }
        complaint.category = category.isBlank() ? "Other" : category;
        complaint.description = description;
        return ResponseEntity.status(HttpStatus.CREATED).body(complaints.save(complaint));
    }

    private synchronized String nextId() {
        String prefix = "SF-" + Year.now(ZoneOffset.UTC).getValue() + "-";
        long sequence = apps.count() + 1;
        String fileId;
        do {
            fileId = prefix + String.format(Locale.ROOT, "%04d", sequence++);
        } while (apps.findByFileId(fileId).isPresent());
        return fileId;
    }

    private void assignHandler(SmartApplication application, AppUser user) {
        application.assignedOfficer = user.fullName;
        application.assignedOfficerRole = user.role;
        application.assignedOfficerEmail = user.email;
    }

    private void clearHandler(SmartApplication application) {
        application.assignedOfficer = null;
        application.assignedOfficerRole = null;
        application.assignedOfficerEmail = null;
    }

    private java.util.Optional<SmartApplication> findVisibleApplication(String fileId, AppUser user) {
        if (user.role.equals("CITIZEN")) {
            return apps.findByFileIdAndOwner_Id(fileId, user.id);
        }
        if (user.role.equals("OFFICER")) {
            return apps.findByFileIdAndAssignedOfficerEmail(fileId, user.email);
        }
        return apps.findByFileId(fileId);
    }
}
