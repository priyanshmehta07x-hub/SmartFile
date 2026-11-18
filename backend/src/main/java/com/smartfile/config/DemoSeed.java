package com.smartfile.config;

import com.smartfile.entity.AppUser;
import com.smartfile.entity.Department;
import com.smartfile.entity.SmartApplication;
import com.smartfile.entity.WorkflowAction;
import com.smartfile.repository.ApplicationRepository;
import com.smartfile.repository.DepartmentRepository;
import com.smartfile.repository.UserRepository;
import com.smartfile.repository.WorkflowActionRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Configuration
public class DemoSeed {
    @Bean
    CommandLineRunner seed(
            UserRepository users,
            DepartmentRepository departments,
            ApplicationRepository apps,
            WorkflowActionRepository actions,
            PasswordEncoder encoder) {
        return args -> {
            for (String name : List.of(
                    "Education", "Revenue", "Urban Development", "Social Welfare",
                    "Public Works", "Commerce", "Finance", "Legal")) {
                if (departments.findByNameIgnoreCase(name).isEmpty()) {
                    departments.save(new Department(name));
                }
            }

            String[][] accounts = {
                    {"citizen@smartfile.demo", "CITIZEN", "Rahul Sharma"},
                    {"citizen-b@smartfile.demo", "CITIZEN", "Ananya Iyer"},
                    {"clerk@smartfile.demo", "CLERK", "Priya Nair"},
                    {"officer@smartfile.demo", "OFFICER", "Arjun Kapoor"},
                    {"admin@smartfile.demo", "ADMIN", "Aarav Mehta"}
            };
            for (String[] row : accounts) {
                if (users.findByEmail(row[0]).isEmpty()) {
                    AppUser user = new AppUser();
                    user.email = row[0];
                    user.role = row[1];
                    user.fullName = row[2];
                    user.passwordHash = encoder.encode("SmartFile@2026");
                    users.save(user);
                }
            }

            if (apps.count() == 0) {
                seedApplications(
                        departments,
                        apps,
                        actions,
                        users.findByEmail("citizen@smartfile.demo").orElseThrow(),
                        users.findByEmail("citizen-b@smartfile.demo").orElseThrow(),
                        users.findFirstByRoleOrderByIdAsc("CLERK").orElseThrow(),
                        users.findFirstByRoleOrderByIdAsc("OFFICER").orElseThrow());
            }
            migrateLegacyStages(apps, actions, users);
        };
    }

    private void seedApplications(
            DepartmentRepository departments,
            ApplicationRepository apps,
            WorkflowActionRepository actions,
            AppUser citizenA,
            AppUser citizenB,
            AppUser clerk,
            AppUser officer) {
        String[] titles = {
                "Scholarship application", "Building permit renewal", "Senior citizen pension",
                "Business registration", "Water connection request", "Land record correction",
                "Student travel concession", "Birth certificate correction", "Streetlight maintenance",
                "Small business grant", "Ration card update", "Disability pension",
                "Property tax appeal", "School transfer certificate", "Road repair request",
                "Education stipend", "Trade license renewal", "Family income certificate",
                "Drainage complaint", "Widow pension"
        };
        String[] names = {
                "Rahul Sharma", "Ananya Iyer", "Mohan Das", "Aditi Verma", "Farhan Ali",
                "Meera Nair", "Sana Khan", "Vikram Rao", "Kavita Joshi", "Rohan Gupta"
        };
        String[] departmentNames = {
                "Education", "Urban Development", "Social Welfare", "Commerce", "Public Works", "Revenue"
        };
        String[] statuses = {
                "Under Review by Clerk", "Pending with Officer", "Documents requested",
                "Final Approved by Officer", "Rejected by Officer", "Returned", "Verified by Clerk"
        };
        Instant now = Instant.now(Clock.systemUTC());
        int year = now.atZone(Clock.systemUTC().getZone()).getYear();

        for (int index = 0; index < titles.length; index++) {
            SmartApplication application = new SmartApplication();
            application.fileId = "SF-" + year + "-" + String.format(Locale.ROOT, "%04d", index + 1);
            application.applicationType = titles[index];
            application.applicantName = index == 0 ? "Rahul Sharma" : names[index % names.length];
            if (index == 0) {
                application.owner = citizenA;
            } else if (index == 1) {
                application.owner = citizenB;
            }
            application.department = departments.findByNameIgnoreCase(
                    departmentNames[index % departmentNames.length]).orElseThrow();
            application.status = statuses[index % statuses.length];
            application.priority = index % 5 == 0 ? "High" : "Normal";
            application.submittedAt = now.minus(index + 1L, ChronoUnit.DAYS);
            application.updatedAt = application.submittedAt;
            application.deadline = now.plus(index % 4 == 0 ? -1 : 1, ChronoUnit.DAYS);
            application.currentStage = application.status;
            if (Set.of("Under Review by Clerk", "Verified by Clerk").contains(application.status)) {
                assignHandler(application, clerk);
            } else if (Set.of(
                    "Pending with Officer", "Final Approved by Officer", "Rejected by Officer")
                    .contains(application.status)) {
                assignHandler(application, officer);
            }
            apps.save(application);
            addHistory(actions, application, application.submittedAt,
                    "system@smartfile.demo", "SUBMITTED", "Seeded demonstration application");

            switch (application.status) {
                case "Under Review by Clerk" ->
                        addHistory(actions, application, application.submittedAt.plusSeconds(5),
                                "system@smartfile.demo", "ASSIGNED_TO_CLERK", "File assigned to Clerk review");
                case "Verified by Clerk" -> {
                    addClerkAssignment(actions, application);
                    addHistory(actions, application, application.submittedAt.plusSeconds(10),
                            clerk.email, "CLERK_VERIFIED", "Documents verified");
                }
                case "Pending with Officer", "Final Approved by Officer", "Rejected by Officer" -> {
                    addClerkAssignment(actions, application);
                    addHistory(actions, application, application.submittedAt.plusSeconds(10),
                            clerk.email, "CLERK_VERIFIED", "Documents verified");
                    addHistory(actions, application, application.submittedAt.plusSeconds(15),
                            clerk.email, "FORWARDED_TO_OFFICER", "Forwarded to " + officer.fullName);
                    addHistory(actions, application, application.submittedAt.plusSeconds(20),
                            "system@smartfile.demo", "ASSIGNED_TO_OFFICER", "File assigned to " + officer.fullName);
                    if (application.status.equals("Final Approved by Officer")) {
                        addHistory(actions, application, application.submittedAt.plusSeconds(25),
                                officer.email, "OFFICER_FINAL_APPROVED", "Final approval completed");
                    } else if (application.status.equals("Rejected by Officer")) {
                        addHistory(actions, application, application.submittedAt.plusSeconds(25),
                                officer.email, "OFFICER_REJECTED", "Rejected by Officer");
                    }
                }
                case "Rejected by Clerk" ->
                        addHistory(actions, application, application.submittedAt.plusSeconds(5),
                                clerk.email, "CLERK_REJECTED", "Rejected during Clerk review");
                case "Documents requested" ->
                        addHistory(actions, application, application.submittedAt.plusSeconds(5),
                                clerk.email, "DOCUMENTS_REQUESTED", "Additional documents requested");
                case "Returned" ->
                        addHistory(actions, application, application.submittedAt.plusSeconds(5),
                                clerk.email, "RETURNED_TO_CITIZEN", "Changes requested");
                default -> {
                }
            }
        }
    }

    private void migrateLegacyStages(
            ApplicationRepository apps,
            WorkflowActionRepository actions,
            UserRepository users) {
        AppUser clerk = users.findFirstByRoleOrderByIdAsc("CLERK").orElseThrow();
        AppUser officer = users.findFirstByRoleOrderByIdAsc("OFFICER").orElseThrow();
        for (SmartApplication application : apps.findAll()) {
            String nextStatus;
            String event;
            String remarks;
            switch (application.status) {
                case "Under Review by Clerk", "Verified by Clerk" -> {
                    if (clerk.email.equalsIgnoreCase(
                            application.assignedOfficerEmail == null ? "" : application.assignedOfficerEmail)
                            && clerk.role.equals(application.assignedOfficerRole)) {
                        continue;
                    }
                    nextStatus = application.status;
                    event = "MIGRATED_TO_CLERK_REVIEW";
                    remarks = "File assigned to the Clerk for verification";
                    assignHandler(application, clerk);
                }
                case "Pending with Officer" -> {
                    if (officer.email.equalsIgnoreCase(
                            application.assignedOfficerEmail == null ? "" : application.assignedOfficerEmail)
                            && officer.role.equals(application.assignedOfficerRole)) {
                        continue;
                    }
                    nextStatus = "Pending with Officer";
                    event = "MIGRATED_TO_OFFICER_REVIEW";
                    remarks = "File assigned to the designated Officer for final decision";
                    assignHandler(application, officer);
                }
                case "Approved by Clerk", "Forwarded to Admin", "Pending with Admin",
                        "Final Approved by Admin", "Rejected by Admin" -> {
                    nextStatus = "Pending with Officer";
                    event = "MIGRATED_TO_OFFICER_REVIEW";
                    remarks = "Legacy Admin-stage application reassigned for Officer decision";
                    application.status = nextStatus;
                    application.currentStage = nextStatus;
                    assignHandler(application, officer);
                }
                case "Approved", "Final approval", "Finance review", "Officer review",
                        "Document check", "Submitted", "Clerk verification", "Rejected" -> {
                    nextStatus = "Under Review by Clerk";
                    event = "MIGRATED_TO_CLERK_REVIEW";
                    remarks = "Legacy status requires Clerk verification before Officer decision";
                    application.status = nextStatus;
                    application.currentStage = nextStatus;
                    assignHandler(application, clerk);
                }
                default -> {
                    continue;
                }
            }
            apps.save(application);
            actions.save(new WorkflowAction(
                    application, "system@smartfile.demo", event, remarks));
        }
    }

    private void addClerkAssignment(WorkflowActionRepository actions, SmartApplication application) {
        addHistory(actions, application, application.submittedAt.plusSeconds(5),
                "system@smartfile.demo", "ASSIGNED_TO_CLERK", "File received by Clerk");
    }

    private void assignHandler(SmartApplication application, AppUser user) {
        application.assignedOfficer = user.fullName;
        application.assignedOfficerRole = user.role;
        application.assignedOfficerEmail = user.email;
    }

    private void addHistory(
            WorkflowActionRepository actions,
            SmartApplication application,
            Instant occurredAt,
            String actor,
            String event,
            String remarks) {
        WorkflowAction action = new WorkflowAction(application, actor, event, remarks);
        action.createdAt = occurredAt;
        actions.save(action);
    }
}
