# Incident Response with Conditional Logic
## Description
This runbook demonstrates advanced conditional logic for incident response procedures. Steps will appear/disappear based on previous answers, creating a dynamic workflow that adapts to the specific incident type.

**Apps:** AWS, Azure, Microsoft, Commvault

---

## Step 1: Incident Classification
**Duration:** 10 minutes  
**Assigned to:** Test Last  
**Description:** Classify the type of incident to determine the appropriate response path
**Apps:** Microsoft

### Tasks
- [ ] **Assess Incident Scope**
  - Description: Determine if this is a security, infrastructure, or application incident
- [ ] **Check System Status**
  - Description: Review monitoring dashboards for system health indicators
- [ ] **Notify Initial Response Team**
  - Description: Alert the appropriate team leads based on incident classification

### Questions
- **Type:** select
- **Question:** What type of incident is this?
- **Options:** Security Breach, Infrastructure Failure, Application Error, Network Outage
- **Required:** true

### Conditions
always_show

### Dependencies
None - Initial classification step

---

## Step 2: Security Incident Response
**Duration:** 45 minutes  
**Assigned to:** John Doe  
**Description:** Execute security incident response procedures for breach containment
**Apps:** Microsoft, AWS

### Tasks
- [ ] **Isolate Affected Systems**
  - Description: Immediately isolate compromised systems from the network
- [ ] **Preserve Evidence**
  - Description: Take snapshots and preserve logs for forensic analysis
- [ ] **Reset Compromised Credentials**
  - Description: Force password resets for all potentially compromised accounts
- [ ] **Notify Legal and Compliance**
  - Description: Inform legal team and compliance officers of the security incident

### Questions
- **Type:** select
- **Question:** Has the security breach been contained?
- **Options:** Yes, Partially, No
- **Required:** true

### Conditions
step_1_question_equals:Security Breach

### Dependencies
This step depends on: Step 1 (Incident Classification)

---

## Step 3: Infrastructure Recovery
**Duration:** 60 minutes  
**Assigned to:** Ty Rep  
**Description:** Restore failed infrastructure components and services
**Apps:** AWS, Azure

### Tasks
- [ ] **Identify Failed Components**
  - Description: Create comprehensive list of failed servers, databases, and network components
- [ ] **Restore from Backups**
  - Description: Restore systems from most recent backups or snapshots
- [ ] **Validate System Connectivity**
  - Description: Test network connectivity and service availability
- [ ] **Update Load Balancers**
  - Description: Update load balancer configurations to include restored systems

### Questions
- **Type:** select
- **Question:** Are all critical systems restored and operational?
- **Options:** Yes, Mostly, No
- **Required:** true

### Conditions
step_1_question_equals:Infrastructure Failure|Network Outage

### Dependencies
This step depends on: Step 1 (Incident Classification)

---

## Step 4: Application Troubleshooting
**Duration:** 30 minutes  
**Assigned to:** Kevin Cronin  
**Description:** Diagnose and resolve application-specific errors and issues
**Apps:** Microsoft, Azure

### Tasks
- [ ] **Review Application Logs**
  - Description: Analyze application logs for error patterns and root causes
- [ ] **Check Database Connectivity**
  - Description: Verify database connections and query performance
- [ ] **Restart Application Services**
  - Description: Restart application services in the correct order
- [ ] **Validate Application Functions**
  - Description: Test critical application functions and user workflows

### Questions
- **Type:** select
- **Question:** Is the application fully functional?
- **Options:** Yes, Limited Functionality, No
- **Required:** true

### Conditions
step_1_question_equals:Application Error

### Dependencies
This step depends on: Step 1 (Incident Classification)

---

## Step 5: Security Validation and Hardening
**Duration:** 35 minutes  
**Assigned to:** Client Account  
**Description:** Additional security validation required after security incidents
**Apps:** AWS, Microsoft

### Tasks
- [ ] **Run Security Scans**
  - Description: Execute vulnerability scans on all affected systems
- [ ] **Update Security Policies**
  - Description: Review and update security policies based on incident findings
- [ ] **Implement Additional Monitoring**
  - Description: Deploy enhanced monitoring for early detection of similar incidents
- [ ] **Conduct Security Training**
  - Description: Schedule security awareness training for affected teams

### Questions
- **Type:** select
- **Question:** Are enhanced security measures in place?
- **Options:** Yes, In Progress, No
- **Required:** true

### Conditions
step_2_question_equals:Yes|Partially

### Dependencies
This step depends on: Step 2 (Security Incident Response)

---

## Step 6: System Performance Validation
**Duration:** 25 minutes  
**Assigned to:** Test Name  
**Description:** Validate system performance after infrastructure or application recovery
**Apps:** AWS, Azure, Commvault

### Tasks
- [ ] **Run Performance Tests**
  - Description: Execute performance benchmarks to ensure systems meet SLA requirements
- [ ] **Monitor Resource Utilization**
  - Description: Check CPU, memory, and disk utilization on all restored systems
- [ ] **Validate Backup Systems**
  - Description: Ensure backup systems are functioning and schedules are current
- [ ] **Update Monitoring Thresholds**
  - Description: Adjust monitoring thresholds based on incident learnings

### Questions
- **Type:** select
- **Question:** Do all systems meet performance requirements?
- **Options:** Yes, Within Acceptable Range, No
- **Required:** true

### Conditions
step_3_question_equals:Yes|Mostly

### Dependencies
This step depends on: Step 3 (Infrastructure Recovery)

---

## Step 7: Final Incident Documentation
**Duration:** 20 minutes  
**Assigned to:** Test Last  
**Description:** Complete incident documentation and conduct lessons learned session
**Apps:** Microsoft

### Tasks
- [ ] **Complete Incident Report**
  - Description: Document incident timeline, impact, and resolution steps
- [ ] **Conduct Lessons Learned Session**
  - Description: Meet with response team to identify process improvements
- [ ] **Update Runbooks**
  - Description: Update incident response runbooks based on lessons learned
- [ ] **Notify Stakeholders**
  - Description: Send final incident summary to all stakeholders

### Questions
- **Type:** select
- **Question:** Has the incident been fully resolved and documented?
- **Options:** Yes, Documentation Pending, No
- **Required:** true

### Conditions
step_2_question_not_equals:No

### Dependencies
This step depends on: Previous response steps

---

# Advanced Conditional Logic Examples

This runbook demonstrates several types of conditional logic:

## 1. Single Answer Conditions:
- **step_1_question_equals:Security Breach** - Shows Step 2 only for security incidents
- **step_1_question_equals:Application Error** - Shows Step 4 only for application issues

## 2. Multiple Answer Conditions:
- **step_1_question_equals:Infrastructure Failure|Network Outage** - Shows Step 3 for infrastructure OR network issues
- **step_3_question_equals:Yes|Mostly** - Shows Step 6 if infrastructure recovery was successful OR mostly successful

## 3. Negative Conditions:
- **step_2_question_not_equals:No** - Shows Step 7 unless security containment completely failed

## 4. Cascading Conditions:
- Step 5 only appears if Step 2 (security response) was successful
- Step 6 only appears if Step 3 (infrastructure recovery) was successful
- This creates branching workflows based on success/failure

## Available Condition Types:
- **always_show** - Step always appears
- **step_X_question_equals:Answer** - Show if specific answer given
- **step_X_question_not_equals:Answer** - Show if specific answer NOT given
- **step_X_question_equals:Answer1|Answer2** - Show if ANY of the listed answers given

This creates dynamic runbooks that adapt to the specific incident type and response success! 