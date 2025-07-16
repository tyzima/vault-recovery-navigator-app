# Test Visibility Rules Runbook
## Description
This runbook tests the visibility rules functionality with proper conditional logic that will work with the VisibilityRuleEditor component.

**Apps:** AWS, Azure, Microsoft

---

## Step 1: Initial Decision Point
**Duration:** 10 minutes  
**Assigned to:** Test Last  
**Description:** Make initial decision that determines which subsequent steps appear
**Apps:** Microsoft

### Tasks
- [ ] **Assess Situation Type**
  - Description: Determine what type of situation we're dealing with

### Questions
- **Type:** select
- **Question:** What type of situation is this?
- **Options:** Emergency, Maintenance, Testing
- **Required:** true

### Conditions
always_show

### Dependencies
None - This is the starting point

---

## Step 2: Emergency Response (Only for Emergencies)
**Duration:** 30 minutes  
**Assigned to:** Ty Rep  
**Description:** Emergency response procedures - only appears for emergency situations
**Apps:** AWS, Azure

### Tasks
- [ ] **Activate Emergency Protocol**
  - Description: Activate emergency response procedures immediately
- [ ] **Notify Stakeholders**
  - Description: Send emergency notifications to all relevant stakeholders

### Questions
- **Type:** select
- **Question:** Is the emergency contained?
- **Options:** Yes, Partially, No
- **Required:** true

### Conditions
step_1_question_equals:Emergency

### Dependencies
This step depends on: Step 1

---

## Step 3: Maintenance Procedures (Only for Maintenance)
**Duration:** 45 minutes  
**Assigned to:** Kevin Cronin  
**Description:** Scheduled maintenance procedures - only appears for maintenance situations
**Apps:** AWS

### Tasks
- [ ] **Prepare Maintenance Window**
  - Description: Set up maintenance window and user notifications
- [ ] **Execute Maintenance Tasks**
  - Description: Perform scheduled maintenance activities

### Questions
- **Type:** select
- **Question:** Is maintenance completed successfully?
- **Options:** Yes, No, Partially
- **Required:** true

### Conditions
step_1_question_equals:Maintenance

### Dependencies
This step depends on: Step 1

---

## Step 4: Testing Procedures (Only for Testing)
**Duration:** 20 minutes  
**Assigned to:** Client Account  
**Description:** Testing procedures - only appears for testing situations
**Apps:** Microsoft

### Tasks
- [ ] **Run Test Suite**
  - Description: Execute comprehensive test suite
- [ ] **Validate Results**
  - Description: Verify all tests pass and document any failures

### Questions
- **Type:** select
- **Question:** Do all tests pass?
- **Options:** Yes, No, Some Failed
- **Required:** true

### Conditions
step_1_question_equals:Testing

### Dependencies
This step depends on: Step 1

---

## Step 5: Emergency Follow-up (Only if Emergency was Contained)
**Duration:** 15 minutes  
**Assigned to:** John Doe  
**Description:** Follow-up actions after emergency containment
**Apps:** AWS, Microsoft

### Tasks
- [ ] **Document Incident**
  - Description: Create detailed incident report
- [ ] **Review Response**
  - Description: Evaluate emergency response effectiveness

### Questions
- **Type:** select
- **Question:** Is incident documentation complete?
- **Options:** Yes, No
- **Required:** true

### Conditions
step_2_question_equals:Yes|Partially

### Dependencies
This step depends on: Step 2 (Emergency Response)

---

## Step 6: Final Validation (Not for Failed Tests)
**Duration:** 10 minutes  
**Assigned to:** Test Name  
**Description:** Final validation - appears unless testing completely failed
**Apps:** Azure

### Tasks
- [ ] **Final System Check**
  - Description: Perform final validation of all systems
- [ ] **Update Status**
  - Description: Update system status and notify teams

### Questions
- **Type:** select
- **Question:** Is system fully operational?
- **Options:** Yes, No
- **Required:** true

### Conditions
step_4_question_not_equals:Some Failed

### Dependencies
This step depends on: Previous steps

---

# How This Demonstrates Visibility Rules:

## Conditional Logic Examples:
1. **step_1_question_equals:Emergency** - Step 2 only shows for Emergency situations
2. **step_1_question_equals:Maintenance** - Step 3 only shows for Maintenance situations  
3. **step_1_question_equals:Testing** - Step 4 only shows for Testing situations
4. **step_2_question_equals:Yes|Partially** - Step 5 shows if emergency was contained (Yes OR Partially)
5. **step_4_question_not_equals:Some Failed** - Step 6 shows unless tests failed

## Expected Behavior:
- **Choose "Emergency"**: Steps 1, 2, 5 (if emergency contained), 6 will appear
- **Choose "Maintenance"**: Steps 1, 3, 6 will appear  
- **Choose "Testing"**: Steps 1, 4, 6 (unless tests failed) will appear

This creates a dynamic workflow that adapts based on user responses! 