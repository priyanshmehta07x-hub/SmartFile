package com.smartfile.repository;

import com.smartfile.entity.AppUser;
import com.smartfile.entity.Complaint;
import com.smartfile.entity.SmartApplication;
import com.smartfile.entity.WorkflowAction;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest
class CitizenOwnershipRepositoryTest {
    @Autowired
    private UserRepository users;
    @Autowired
    private ApplicationRepository applications;
    @Autowired
    private WorkflowActionRepository actions;
    @Autowired
    private ComplaintRepository complaints;

    @Test
    void ownerQueriesDoNotConfuseCitizensWithTheSameName() {
        AppUser citizenA = users.save(user("citizen-a@example.test"));
        AppUser citizenB = users.save(user("citizen-b@example.test"));
        SmartApplication applicationA = applications.save(application("SF-A", citizenA));
        SmartApplication applicationB = applications.save(application("SF-B", citizenB));

        actions.save(new WorkflowAction(applicationA, citizenA.email, "SUBMITTED", "A"));
        actions.save(new WorkflowAction(applicationB, citizenB.email, "SUBMITTED", "B"));

        Complaint complaintA = new Complaint();
        complaintA.complaintId = "CMP-A";
        complaintA.applicantName = citizenA.fullName;
        complaintA.owner = citizenA;
        complaints.save(complaintA);
        Complaint complaintB = new Complaint();
        complaintB.complaintId = "CMP-B";
        complaintB.applicantName = citizenB.fullName;
        complaintB.owner = citizenB;
        complaints.save(complaintB);

        assertEquals(List.of(applicationA),
                applications.findAllByOwner_IdOrderBySubmittedAtDesc(citizenA.id));
        assertTrue(applications.findByFileIdAndOwner_Id(applicationB.fileId, citizenA.id).isEmpty());
        assertEquals(List.of(actions.findByApplicationFileIdOrderByCreatedAtAscIdAsc(applicationA.fileId).get(0)),
                actions.findByApplication_Owner_IdOrderByCreatedAtDesc(citizenA.id));
        assertEquals(List.of(complaintA), complaints.findAllByOwner_IdOrderByCreatedAtDesc(citizenA.id));
    }

    @Test
    void officerQueriesReturnOnlyApplicationsAssignedToThatOfficer() {
        AppUser officerA = user("officer-a@example.test");
        officerA.role = "OFFICER";
        AppUser officerB = user("officer-b@example.test");
        officerB.role = "OFFICER";
        officerA = users.save(officerA);
        officerB = users.save(officerB);
        SmartApplication applicationA = application("SF-OA", officerA);
        applicationA.assignedOfficerEmail = officerA.email;
        applicationA.assignedOfficerRole = officerA.role;
        SmartApplication applicationB = application("SF-OB", officerB);
        applicationB.assignedOfficerEmail = officerB.email;
        applicationB.assignedOfficerRole = officerB.role;
        applications.saveAll(List.of(applicationA, applicationB));
        WorkflowAction decisionA = actions.save(new WorkflowAction(
                applicationA, officerA.email, "OFFICER_FINAL_APPROVED", "Approved"));
        actions.save(new WorkflowAction(applicationB, officerB.email, "OFFICER_FINAL_APPROVED", "Approved"));

        assertEquals(List.of(applicationA),
                applications.findAllByAssignedOfficerEmailOrderBySubmittedAtDesc(officerA.email));
        assertTrue(applications.findByFileIdAndAssignedOfficerEmail(applicationB.fileId, officerA.email).isEmpty());
        assertEquals(List.of(decisionA),
                actions.findByApplication_AssignedOfficerEmailOrderByCreatedAtDesc(officerA.email));
    }

    private static AppUser user(String email) {
        AppUser user = new AppUser();
        user.email = email;
        user.passwordHash = "test-hash";
        user.role = "CITIZEN";
        user.fullName = "Shared Applicant Name";
        return user;
    }

    private static SmartApplication application(String fileId, AppUser owner) {
        SmartApplication application = new SmartApplication();
        application.fileId = fileId;
        application.applicationType = "Example";
        application.applicantName = owner.fullName;
        application.owner = owner;
        application.submittedAt = Instant.parse("2026-01-01T00:00:00Z");
        return application;
    }
}
