# Database Disaster Recovery and Failover Procedure

## Description
This runbook provides comprehensive procedures for recovering from a critical database failure affecting our primary PostgreSQL clusters. It includes failover procedures, data restoration from backups, and validation steps to ensure business continuity.

**Apps:** AWS, Microsoft, Azure, Commvault

---

## Step 1: Initial Assessment and Emergency Response
**Duration:** 15 minutes  
**Assigned to:** Kevin Cronin  
**Description:** Rapid assessment of database failure scope and initiation of emergency response procedures
**Apps:** AWS, Azure

### Tasks
- [ ] **Verify Database Connectivity**
  - Description: Test connections to all primary and secondary database instances across AWS RDS and Azure SQL
- [ ] **Check Application Health**
  - Description: Assess impact on dependent applications and services
- [ ] **Notify Stakeholders**
  - Description: Send immediate notification to Infrastructure Team and Application/DevOps Team leads
- [ ] **Document Incident Timeline**
  - Description: Begin incident log with timestamps and initial observations

### Questions
- **Type:** select
- **Question:** What is the scope of the database failure?
- **Options:** Single Instance, Multiple Instances, Complete Cluster Failure, Cross-Region Failure
- **Required:** true

### Conditions
This step is always executed first in any database emergency

### Dependencies
None - This is the initial emergency response step

---

## Step 2: AWS RDS Primary Recovery
**Duration:** 30 minutes  
**Assigned to:** Ty Rep  
**Description:** Restore AWS RDS instances from automated backups and snapshots
**Apps:** AWS

### Tasks
- [ ] **Identify Latest Backup**
  - Description: Locate the most recent automated backup and manual snapshot for each affected RDS instance
- [ ] **Initiate Point-in-Time Recovery**
  - Description: Create new RDS instances from the latest viable recovery point
- [ ] **Configure Security Groups**
  - Description: Apply appropriate security groups and parameter groups to restored instances
- [ ] **Update DNS Records**
  - Description: Update Route 53 DNS records to point to restored database instances

### Questions
- **Type:** select
- **Question:** Which AWS regions are affected?
- **Options:** us-east-1, us-west-2, eu-west-1, Multiple Regions
- **Required:** true

### Conditions
Execute only if AWS RDS instances are affected

### Dependencies
This step depends on: Step 1 (Initial Assessment)

---

## Step 3: Azure SQL Database Recovery
**Duration:** 25 minutes  
**Assigned to:** Client Account  
**Description:** Restore Azure SQL databases from geo-redundant backups
**Apps:** Azure, Microsoft

### Tasks
- [ ] **Access Azure Portal**
  - Description: Log into Azure portal and navigate to SQL Database service
- [ ] **Initiate Geo-Restore**
  - Description: Restore databases from geo-redundant backups to secondary region if needed
- [ ] **Configure Firewall Rules**
  - Description: Set up appropriate firewall rules and virtual network access
- [ ] **Test Database Connectivity**
  - Description: Verify restored databases are accessible and responsive

### Questions
- **Type:** select
- **Question:** Should we restore to the same region or failover to secondary?
- **Options:** Same Region, Secondary Region, Both for Testing
- **Required:** true

### Conditions
Execute if Azure SQL databases are in scope

### Dependencies
This step can run in parallel with Step 2

---

## Step 4: Backup Verification with Commvault
**Duration:** 20 minutes  
**Assigned to:** John Doe  
**Description:** Verify and validate backup integrity using Commvault systems
**Apps:** Commvault

### Tasks
- [ ] **Check Commvault Console**
  - Description: Access Commvault Command Center and review recent backup job status
- [ ] **Verify Backup Completeness**
  - Description: Ensure all critical databases were successfully backed up in the last 24 hours
- [ ] **Test Backup Restore**
  - Description: Perform test restore of a small database to verify backup integrity
- [ ] **Document Backup Status**
  - Description: Create summary report of backup status for all affected systems

### Questions
- **Type:** select
- **Question:** Are all recent backups verified as complete and restorable?
- **Options:** Yes - All Good, Partial - Some Issues, No - Major Problems
- **Required:** true

### Conditions
Execute to ensure backup systems are reliable for this recovery

### Dependencies
This step can run independently but should complete before final validation

---

## Step 5: Data Consistency and Validation
**Duration:** 40 minutes  
**Assigned to:** Test Last  
**Description:** Comprehensive validation of restored databases and data integrity checks
**Apps:** AWS, Azure, Microsoft

### Tasks
- [ ] **Run Database Consistency Checks**
  - Description: Execute DBCC CHECKDB (SQL Server) or equivalent consistency checks on all restored databases
- [ ] **Validate Critical Tables**
  - Description: Perform row counts and checksums on business-critical tables
- [ ] **Test Application Connections**
  - Description: Verify that applications can successfully connect and perform basic operations
- [ ] **Compare Data Timestamps**
  - Description: Ensure data timestamps align with expected recovery point objectives

### Questions
- **Type:** select
- **Question:** What is the maximum acceptable data loss for this incident?
- **Options:** Zero Loss, Under 1 Hour, 1-4 Hours, Over 4 Hours Acceptable
- **Required:** true

### Conditions
Execute only after database restoration is complete

### Dependencies
This step depends on: Step 2 (AWS Recovery) and Step 3 (Azure Recovery)

---

## Step 6: Application and Service Restart
**Duration:** 35 minutes  
**Assigned to:** Test Name  
**Description:** Restart and validate all dependent applications and services
**Apps:** Microsoft, AWS, Azure

### Tasks
- [ ] **Restart Application Services**
  - Description: Restart all applications that depend on the restored databases
- [ ] **Update Connection Strings**
  - Description: Update application configuration files with new database endpoints if needed
- [ ] **Perform Health Checks**
  - Description: Run comprehensive health checks on all applications
- [ ] **Monitor Application Logs**
  - Description: Review application logs for any database connection errors or data issues

### Questions
- **Type:** select
- **Question:** Are all critical business applications operational?
- **Options:** Yes - All Running, Mostly - Minor Issues, No - Major Problems
- **Required:** true

### Conditions
Execute after databases are restored and validated

### Dependencies
This step depends on: Step 5 (Data Validation)

---

## Step 7: Final Validation and Documentation
**Duration:** 30 minutes  
**Assigned to:** Kevin Cronin  
**Description:** Final system validation and incident documentation
**Apps:** AWS, Azure, Microsoft, Commvault

### Tasks
- [ ] **End-to-End Testing**
  - Description: Perform complete business process testing to ensure full functionality
- [ ] **Performance Monitoring**
  - Description: Monitor database performance metrics to ensure optimal operation
- [ ] **Update Monitoring Systems**
  - Description: Ensure all monitoring and alerting systems are tracking the restored databases
- [ ] **Complete Incident Report**
  - Description: Document lessons learned, timeline, and recommendations for future improvements

### Questions
- **Type:** select
- **Question:** What was the total recovery time achieved?
- **Options:** Under 1 Hour, 1-2 Hours, 2-4 Hours, 4-6 Hours, Over 6 Hours
- **Required:** true

### Conditions
Execute as the final step to ensure complete recovery

### Dependencies
This step depends on: All previous steps (1-6)

---

# Additional Information

## Available Team Assignments:
- **Kevin Cronin** - Database Team specialist
- **Ty Rep** - Kelyn representative with AWS expertise  
- **Client Account** - Infrastructure team member
- **John Doe** - Client admin with backup systems knowledge
- **Test Last** - Kelyn admin with validation expertise
- **Test Name** - Application team member

## Available Apps:
- **AWS** - Amazon Web Services
- **Azure** - Microsoft Azure
- **Microsoft** - Microsoft technologies
- **Google** - Google Cloud Platform
- **Commvault** - Backup and recovery platform

## Teams Available:
- **Infrastructure Team** - Physical and cloud infrastructure
- **Database Team** - Data storage systems and backups
- **Application/DevOps Team** - CI/CD and app deployment
- **Security & Compliance Team** - Access control and compliance 