package com.smartfile.controller;

import com.smartfile.entity.AppUser;
import com.smartfile.entity.Department;
import com.smartfile.entity.SmartApplication;
import com.smartfile.entity.WorkflowAction;
import com.smartfile.repository.ApplicationRepository;
import com.smartfile.repository.ComplaintRepository;
import com.smartfile.repository.DepartmentRepository;
import com.smartfile.repository.UserRepository;
import com.smartfile.repository.WorkflowActionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

class ApiControllerCitizenAccessTest {
    private AppUser citizen;
    private Principal principal;
    private UserRepository users;
    private DepartmentRepository departments;
    private ApplicationRepository apps;
    private WorkflowActionRepository actions;
    private ApiController controller;

    @BeforeEach
    void setUp() {
        citizen = new AppUser();
        citizen.id = 42L;
        citizen.email = "citizen@example.test";
        citizen.fullName = "Shared Name";
        citizen.role = "CITIZEN";
        principal = () -> citizen.email;
        users = repository(UserRepository.class, (proxy, method, args) -> {
            if (method.getName().equals("findByEmail")) return Optional.of(citizen);
            if (method.getName().equals("findFirstByRoleOrderByIdAsc")) {
                return Optional.of(user(10L, "clerk@example.test", "CLERK"));
            }
            return defaultValue(method.getReturnType());
        });
        departments = repository(DepartmentRepository.class,
                (proxy, method, args) -> defaultValue(method.getReturnType()));
        apps = repository(ApplicationRepository.class,
                (proxy, method, args) -> defaultValue(method.getReturnType()));
        actions = repository(WorkflowActionRepository.class, (proxy, method, args) -> {
            if (method.getName().equals("save")) return args[0];
            return defaultValue(method.getReturnType());
        });
        controller = new ApiController(
                users,
                departments,
                apps,
                actions,
                repository(ComplaintRepository.class, (proxy, method, args) -> defaultValue(method.getReturnType())),
                null,
                null);
    }

    @Test
    void listUsesTheAuthenticatedCitizenIdInsteadOfApplicantName() {
        SmartApplication ownApplication = new SmartApplication();
        ownApplication.applicantName = citizen.fullName;
        ownApplication.owner = citizen;
        apps = repository(ApplicationRepository.class, (proxy, method, args) -> {
            if (method.getName().equals("findAllByOwner_IdOrderBySubmittedAtDesc")) {
                return List.of(ownApplication);
            }
            return defaultValue(method.getReturnType());
        });
        controller = controllerWith(apps);

        assertEquals(List.of(ownApplication), controller.list(principal));
    }

    @Test
    void anotherCitizensApplicationCannotBeFetchedOrTrackedEvenWhenNamesMatch() {
        AppUser anotherCitizen = new AppUser();
        anotherCitizen.id = 99L;
        anotherCitizen.fullName = citizen.fullName;
        SmartApplication otherApplication = new SmartApplication();
        otherApplication.fileId = "SF-2026-0001";
        otherApplication.applicantName = citizen.fullName;
        otherApplication.owner = anotherCitizen;
        apps = repository(ApplicationRepository.class, (proxy, method, args) -> {
            if (method.getName().equals("findByFileIdAndOwner_Id")
                    && args[1].equals(anotherCitizen.id)) {
                return Optional.of(otherApplication);
            }
            return defaultValue(method.getReturnType());
        });
        controller = controllerWith(apps);

        assertEquals(HttpStatus.NOT_FOUND, controller.get("SF-2026-0001", principal).getStatusCode());
        assertEquals(HttpStatus.NOT_FOUND, controller.track("SF-2026-0001", principal).getStatusCode());
    }

    @Test
    void citizenApplicationsAreBoundToTheAuthenticatedAccountOnCreation() {
        Department department = new Department("Education");
        departments = repository(DepartmentRepository.class, (proxy, method, args) -> {
            if (method.getName().equals("findByNameIgnoreCase")) return Optional.of(department);
            return defaultValue(method.getReturnType());
        });
        apps = repository(ApplicationRepository.class, (proxy, method, args) -> {
            if (method.getName().equals("count")) return 0L;
            if (method.getName().equals("findByFileId")) return Optional.empty();
            if (method.getName().equals("save")) return args[0];
            return defaultValue(method.getReturnType());
        });
        controller = controllerWith(apps);

        var result = controller.create(
                Map.of(
                        "applicationType", "Scholarship",
                        "applicantName", citizen.fullName,
                        "department", "Education",
                        "priority", "Normal"),
                principal);

        SmartApplication saved = (SmartApplication) result.getBody();
        assertEquals(HttpStatus.CREATED, result.getStatusCode());
        assertSame(citizen, saved.owner);
    }

    @Test
    void clerkMustVerifyBeforeForwardingToTheAssignedOfficer() {
        AppUser clerk = user(11L, "clerk@example.test", "CLERK");
        SmartApplication application = application("Under Review by Clerk");
        List<WorkflowAction> history = new java.util.ArrayList<>();
        controller = controllerFor(clerk, application, history);

        var verifyResult = controller.action(
                "SF-2026-0010",
                Map.of("action", "VERIFY", "remarks", "Documents verified"),
                () -> clerk.email);

        assertEquals(HttpStatus.OK, verifyResult.getStatusCode());
        assertEquals("Verified by Clerk", application.status);
        assertEquals(clerk.fullName, application.assignedOfficer);

        var forwardResult = controller.action(
                "SF-2026-0010",
                Map.of(
                        "action", "FORWARD",
                        "remarks", "Forwarding to Officer",
                        "assignedOfficerEmail", "officer@example.test"),
                () -> clerk.email);

        assertEquals(HttpStatus.OK, forwardResult.getStatusCode());
        assertEquals("Pending with Officer", application.status);
        assertEquals("OFFICER", application.assignedOfficerRole);
        assertEquals("officer@example.test", application.assignedOfficerEmail);
        assertEquals(List.of("CLERK_VERIFIED", "FORWARDED_TO_OFFICER", "ASSIGNED_TO_OFFICER"),
                history.stream().map(action -> action.action).toList());
    }

    @Test
    void clerkCannotForwardToAnAccountThatIsNotAnOfficer() {
        AppUser clerk = user(11L, "clerk@example.test", "CLERK");
        SmartApplication application = application("Verified by Clerk");
        controller = controllerFor(clerk, application, new java.util.ArrayList<>());

        var result = controller.action(
                "SF-2026-0010",
                Map.of("action", "FORWARD", "assignedOfficerEmail", "not-an-officer@example.test"),
                () -> clerk.email);

        assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
        assertEquals("Verified by Clerk", application.status);
    }

    @Test
    void officerDirectoryIsNotVisibleToCitizens() {
        var result = controller.officerList(() -> citizen.email);

        assertEquals(HttpStatus.FORBIDDEN, result.getStatusCode());
    }

    @Test
    void clerkCannotSubmitFinalApproval() {
        AppUser clerk = user(11L, "clerk@example.test", "CLERK");
        SmartApplication application = application("Under Review by Clerk");
        controller = controllerFor(clerk, application, new java.util.ArrayList<>());

        var result = controller.action(
                "SF-2026-0010",
                Map.of("action", "FINAL_APPROVE"),
                () -> clerk.email);

        assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
        assertEquals("Under Review by Clerk", application.status);
    }

    @Test
    void adminCannotPerformWorkflowActions() {
        AppUser admin = user(12L, "admin@example.test", "ADMIN");
        SmartApplication application = application("Under Review by Clerk");
        controller = controllerFor(admin, application, new java.util.ArrayList<>());

        var result = controller.action(
                "SF-2026-0010",
                Map.of("action", "FINAL_APPROVE"),
                () -> admin.email);

        assertEquals(HttpStatus.FORBIDDEN, result.getStatusCode());
        assertEquals("Under Review by Clerk", application.status);
    }

    @Test
    void onlyTheAssignedOfficerCanCompleteAnApplicationAfterClerkVerification() {
        AppUser officer = user(13L, "officer@example.test", "OFFICER");
        SmartApplication application = application("Pending with Officer");
        application.assignedOfficer = officer.fullName;
        application.assignedOfficerRole = officer.role;
        application.assignedOfficerEmail = officer.email;
        List<WorkflowAction> history = new java.util.ArrayList<>();
        controller = controllerFor(officer, application, history);

        var result = controller.action(
                "SF-2026-0010",
                Map.of("action", "FINAL_APPROVE"),
                () -> officer.email);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals("Final Approved by Officer", application.status);
        assertEquals("Final Approved by Officer", application.currentStage);
        assertEquals(officer.fullName, application.assignedOfficer);
        assertEquals(List.of("OFFICER_FINAL_APPROVED"),
                history.stream().map(action -> action.action).toList());
    }

    @Test
    void assignedOfficerCanRejectWithAnAuditedFinalDecision() {
        AppUser officer = user(13L, "officer@example.test", "OFFICER");
        SmartApplication application = application("Pending with Officer");
        application.assignedOfficer = officer.fullName;
        application.assignedOfficerRole = officer.role;
        application.assignedOfficerEmail = officer.email;
        List<WorkflowAction> history = new java.util.ArrayList<>();
        controller = controllerFor(officer, application, history);

        var result = controller.action(
                "SF-2026-0010",
                Map.of("action", "REJECT", "remarks", "Eligibility requirements not met"),
                () -> officer.email);

        assertEquals(HttpStatus.OK, result.getStatusCode());
        assertEquals("Rejected by Officer", application.status);
        assertEquals(List.of("OFFICER_REJECTED"),
                history.stream().map(action -> action.action).toList());
    }

    @Test
    void anotherOfficerCannotDecideAnApplicationAssignedToSomeoneElse() {
        AppUser otherOfficer = user(14L, "other-officer@example.test", "OFFICER");
        SmartApplication application = application("Pending with Officer");
        application.assignedOfficer = "Assigned Officer";
        application.assignedOfficerRole = "OFFICER";
        application.assignedOfficerEmail = "officer@example.test";
        controller = controllerFor(otherOfficer, application, new java.util.ArrayList<>());

        var result = controller.action(
                "SF-2026-0010",
                Map.of("action", "FINAL_APPROVE"),
                () -> otherOfficer.email);

        assertEquals(HttpStatus.NOT_FOUND, result.getStatusCode());
        assertEquals("Pending with Officer", application.status);
    }

    private ApiController controllerWith(ApplicationRepository applicationRepository) {
        return new ApiController(users, departments, applicationRepository, actions,
                repository(ComplaintRepository.class, (proxy, method, args) -> defaultValue(method.getReturnType())),
                (PasswordEncoder) null, null);
    }

    private ApiController controllerFor(AppUser actor, SmartApplication application, List<WorkflowAction> history) {
        UserRepository actorUsers = repository(UserRepository.class, (proxy, method, args) -> {
            if (method.getName().equals("findByEmail")) {
                if ("officer@example.test".equals(args[0])) {
                    return Optional.of(user(13L, "officer@example.test", "OFFICER"));
                }
                return Optional.of(actor);
            }
            return defaultValue(method.getReturnType());
        });
        ApplicationRepository actorApps = repository(ApplicationRepository.class, (proxy, method, args) -> {
            if (method.getName().equals("findByFileId")) return Optional.of(application);
            if (method.getName().equals("findByFileIdAndAssignedOfficerEmail")) {
                return args[1].equals(application.assignedOfficerEmail)
                        ? Optional.of(application)
                        : Optional.empty();
            }
            if (method.getName().equals("save")) return args[0];
            return defaultValue(method.getReturnType());
        });
        WorkflowActionRepository actorActions = repository(WorkflowActionRepository.class, (proxy, method, args) -> {
            if (method.getName().equals("save")) {
                history.add((WorkflowAction) args[0]);
                return args[0];
            }
            return defaultValue(method.getReturnType());
        });
        return new ApiController(actorUsers, departments, actorApps, actorActions,
                repository(ComplaintRepository.class, (proxy, method, args) -> defaultValue(method.getReturnType())),
                null, null);
    }

    private static AppUser user(Long id, String email, String role) {
        AppUser user = new AppUser();
        user.id = id;
        user.email = email;
        user.role = role;
        user.fullName = role;
        return user;
    }

    private static SmartApplication application(String status) {
        SmartApplication application = new SmartApplication();
        application.fileId = "SF-2026-0010";
        application.status = status;
        application.currentStage = status;
        return application;
    }

    private static <T> T repository(Class<T> type, InvocationHandler handler) {
        return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler));
    }

    private static Object defaultValue(Class<?> returnType) {
        if (returnType == Optional.class) return Optional.empty();
        if (returnType == List.class) return List.of();
        if (returnType == long.class || returnType == Long.class) return 0L;
        if (returnType == int.class || returnType == Integer.class) return 0;
        if (returnType == boolean.class || returnType == Boolean.class) return false;
        return null;
    }
}
