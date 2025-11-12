# Phase 4: AWS Infrastructure & Production Deployment - Detailed Implementation Plan

**Timeline**: Week 27-30 (4 weeks)
**Goal**: Deploy entire platform to AWS with production-grade infrastructure, CI/CD, monitoring, and security

---

## Overview

Phase 4 transforms the development environment into a production-ready, scalable AWS deployment. This phase focuses on:

1. **Infrastructure as Code** - AWS CDK for all resources
2. **Service Migration** - Move all services to AWS (ECS, RDS, ElastiCache, etc.)
3. **CI/CD Pipeline** - Automated testing and deployment
4. **Monitoring & Logging** - CloudWatch, alarms, and dashboards
5. **Security Hardening** - WAF, secrets management, network security
6. **Performance Optimization** - Caching, CDN, auto-scaling

---

## Week 27: Infrastructure as Code (4.1)

### Day 1-2: AWS CDK Setup

#### Initialize CDK Project

```bash
cd /Users/matthewfrank/Documents/Business/JobGraph
mkdir infrastructure
cd infrastructure

# Initialize CDK project
npm init -y
npm install aws-cdk-lib constructs
npm install --save-dev @types/node typescript

# Initialize CDK app
npx cdk init app --language typescript
```

#### Configure CDK Context

**Update `cdk.json`**:
```json
{
  "app": "npx ts-node bin/jobgraph.ts",
  "context": {
    "@aws-cdk/core:newStyleStackSynthesis": true,
    "environments": {
      "dev": {
        "account": "YOUR_AWS_ACCOUNT_ID",
        "region": "us-east-1",
        "domainName": "dev.jobgraph.com",
        "certificateArn": "arn:aws:acm:..."
      },
      "prod": {
        "account": "YOUR_AWS_ACCOUNT_ID",
        "region": "us-east-1",
        "domainName": "jobgraph.com",
        "certificateArn": "arn:aws:acm:..."
      }
    }
  }
}
```

#### Bootstrap CDK

```bash
# Bootstrap CDK for your AWS account
cdk bootstrap aws://ACCOUNT-ID/us-east-1

# Verify bootstrap
aws cloudformation describe-stacks --stack-name CDKToolkit
```

### Day 3-5: Core Infrastructure Stack

**Main Stack** (`infrastructure/lib/jobgraph-stack.ts`):
```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NetworkStack } from './stacks/network-stack';
import { DatabaseStack } from './stacks/database-stack';
import { CacheStack } from './stacks/cache-stack';
import { StorageStack } from './stacks/storage-stack';
import { ComputeStack } from './stacks/compute-stack';
import { AuthStack } from './stacks/auth-stack';
import { MonitoringStack } from './stacks/monitoring-stack';

export class JobGraphStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const env = this.node.tryGetContext('env') || 'dev';
    const envConfig = this.node.tryGetContext('environments')[env];

    // Network Infrastructure
    const networkStack = new NetworkStack(this, 'Network', {
      env: envConfig,
      stackName: `JobGraph-Network-${env}`,
    });

    // Database
    const databaseStack = new DatabaseStack(this, 'Database', {
      env: envConfig,
      vpc: networkStack.vpc,
      stackName: `JobGraph-Database-${env}`,
    });

    // Cache
    const cacheStack = new CacheStack(this, 'Cache', {
      env: envConfig,
      vpc: networkStack.vpc,
      stackName: `JobGraph-Cache-${env}`,
    });

    // Storage
    const storageStack = new StorageStack(this, 'Storage', {
      env: envConfig,
      stackName: `JobGraph-Storage-${env}`,
    });

    // Authentication (Cognito)
    const authStack = new AuthStack(this, 'Auth', {
      env: envConfig,
      stackName: `JobGraph-Auth-${env}`,
    });

    // Compute (ECS Services)
    const computeStack = new ComputeStack(this, 'Compute', {
      env: envConfig,
      vpc: networkStack.vpc,
      database: databaseStack.database,
      redis: cacheStack.redisCluster,
      userPool: authStack.userPool,
      buckets: storageStack.buckets,
      stackName: `JobGraph-Compute-${env}`,
    });

    // Monitoring
    const monitoringStack = new MonitoringStack(this, 'Monitoring', {
      env: envConfig,
      services: computeStack.services,
      database: databaseStack.database,
      stackName: `JobGraph-Monitoring-${env}`,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: computeStack.apiUrl,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: authStack.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: databaseStack.database.dbInstanceEndpointAddress,
      description: 'RDS Database Endpoint',
    });
  }
}
```

**Network Stack** (`infrastructure/lib/stacks/network-stack.ts`):
```typescript
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class NetworkStack extends cdk.NestedStack {
  public readonly vpc: ec2.Vpc;
  public readonly albSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: cdk.NestedStackProps) {
    super(scope, id, props);

    // VPC with public, private, and isolated subnets
    this.vpc = new ec2.Vpc(this, 'JobGraphVPC', {
      maxAzs: 2,
      natGateways: 1, // 1 for dev, 2 for prod
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // VPC Endpoints for AWS Services (reduce NAT costs)
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    this.vpc.addGatewayEndpoint('DynamoDBEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });

    // Security Group for ALB
    this.albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });

    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS from internet'
    );

    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP from internet'
    );

    // Tags
    cdk.Tags.of(this.vpc).add('Project', 'JobGraph');
    cdk.Tags.of(this.vpc).add('ManagedBy', 'CDK');
  }
}
```

**Database Stack** (`infrastructure/lib/stacks/database-stack.ts`):
```typescript
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface DatabaseStackProps extends cdk.NestedStackProps {
  vpc: ec2.Vpc;
  env: string;
}

export class DatabaseStack extends cdk.NestedStack {
  public readonly database: rds.DatabaseInstance;
  public readonly databaseSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const isProd = props.env === 'prod';

    // Database credentials stored in Secrets Manager
    this.databaseSecret = new secretsmanager.Secret(this, 'DBSecret', {
      secretName: `jobgraph-db-credentials-${props.env}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'jobgraph_admin' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\',
        passwordLength: 32,
      },
    });

    // Security Group for RDS
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DBSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for RDS PostgreSQL',
      allowAllOutbound: false,
    });

    // RDS PostgreSQL Instance
    this.database = new rds.DatabaseInstance(this, 'PostgreSQL', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_3,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        isProd ? ec2.InstanceSize.LARGE : ec2.InstanceSize.MEDIUM
      ),
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [dbSecurityGroup],
      credentials: rds.Credentials.fromSecret(this.databaseSecret),
      databaseName: 'jobgraph',
      allocatedStorage: isProd ? 100 : 50,
      maxAllocatedStorage: isProd ? 500 : 200,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      multiAz: isProd,
      backupRetention: cdk.Duration.days(isProd ? 14 : 7),
      preferredBackupWindow: '03:00-04:00', // 3-4 AM UTC
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
      deletionProtection: isProd,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.SNAPSHOT,
      enablePerformanceInsights: isProd,
      performanceInsightRetention: isProd
        ? rds.PerformanceInsightRetention.LONG_TERM
        : undefined,
      cloudwatchLogsExports: ['postgresql'],
    });

    // CloudWatch Alarms
    this.database.metricCPUUtilization().createAlarm(this, 'DBHighCPU', {
      threshold: 80,
      evaluationPeriods: 2,
      alarmDescription: 'Alert when DB CPU exceeds 80%',
    });

    this.database.metricFreeStorageSpace().createAlarm(this, 'DBLowStorage', {
      threshold: 10 * 1024 * 1024 * 1024, // 10 GB
      evaluationPeriods: 1,
      alarmDescription: 'Alert when DB free storage is below 10GB',
    });

    // Outputs
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.database.dbInstanceEndpointAddress,
      description: 'RDS PostgreSQL Endpoint',
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.databaseSecret.secretArn,
      description: 'Database Credentials Secret ARN',
    });
  }
}
```

**Cache Stack** (`infrastructure/lib/stacks/cache-stack.ts`):
```typescript
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';

interface CacheStackProps extends cdk.NestedStackProps {
  vpc: ec2.Vpc;
  env: string;
}

export class CacheStack extends cdk.NestedStack {
  public readonly redisCluster: elasticache.CfnCacheCluster;
  public readonly redisSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: CacheStackProps) {
    super(scope, id, props);

    const isProd = props.env === 'prod';

    // Security Group for Redis
    this.redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for ElastiCache Redis',
      allowAllOutbound: false,
    });

    // Subnet Group for ElastiCache
    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for ElastiCache Redis',
      subnetIds: props.vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }).subnetIds,
      cacheSubnetGroupName: `jobgraph-redis-subnet-${props.env}`,
    });

    // ElastiCache Redis Cluster
    this.redisCluster = new elasticache.CfnCacheCluster(this, 'Redis', {
      cacheNodeType: isProd ? 'cache.t3.medium' : 'cache.t3.micro',
      engine: 'redis',
      engineVersion: '7.0',
      numCacheNodes: 1,
      clusterName: `jobgraph-redis-${props.env}`,
      vpcSecurityGroupIds: [this.redisSecurityGroup.securityGroupId],
      cacheSubnetGroupName: subnetGroup.ref,
      preferredMaintenanceWindow: 'sun:05:00-sun:06:00',
      snapshotRetentionLimit: isProd ? 7 : 1,
      snapshotWindow: '03:00-05:00',
      autoMinorVersionUpgrade: true,
    });

    this.redisCluster.addDependency(subnetGroup);

    // Outputs
    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.redisCluster.attrRedisEndpointAddress,
      description: 'Redis Cluster Endpoint',
    });

    new cdk.CfnOutput(this, 'RedisPort', {
      value: this.redisCluster.attrRedisEndpointPort,
      description: 'Redis Cluster Port',
    });
  }
}
```

**Storage Stack** (`infrastructure/lib/stacks/storage-stack.ts`):
```typescript
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

interface StorageStackProps extends cdk.NestedStackProps {
  env: string;
}

export class StorageStack extends cdk.NestedStack {
  public readonly buckets: {
    resumes: s3.Bucket;
    assets: s3.Bucket;
    profilePictures: s3.Bucket;
  };
  public readonly cdn: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const isProd = props.env === 'prod';

    // Resumes Bucket (Private)
    this.buckets.resumes = new s3.Bucket(this, 'ResumesBucket', {
      bucketName: `jobgraph-resumes-${props.env}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'ArchiveOldResumes',
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
          enabled: isProd,
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: [
            isProd ? 'https://jobgraph.com' : 'http://localhost:5173',
          ],
          allowedHeaders: ['*'],
        },
      ],
    });

    // Profile Pictures Bucket (Public Read)
    this.buckets.profilePictures = new s3.Bucket(this, 'ProfilePicturesBucket', {
      bucketName: `jobgraph-profile-pictures-${props.env}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      publicReadAccess: true,
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          noncurrentVersionExpiration: cdk.Duration.days(30),
          enabled: true,
        },
      ],
    });

    // Assets Bucket (Static files, logos, etc.)
    this.buckets.assets = new s3.Bucket(this, 'AssetsBucket', {
      bucketName: `jobgraph-assets-${props.env}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      publicReadAccess: true,
    });

    // CloudFront Distribution for Assets
    this.cdn = new cloudfront.Distribution(this, 'AssetsCDN', {
      defaultBehavior: {
        origin: new origins.S3Origin(this.buckets.assets),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/profile-pictures/*': {
          origin: new origins.S3Origin(this.buckets.profilePictures),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      priceClass: isProd
        ? cloudfront.PriceClass.PRICE_CLASS_ALL
        : cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ResumesBucketName', {
      value: this.buckets.resumes.bucketName,
      description: 'S3 Bucket for Resumes',
    });

    new cdk.CfnOutput(this, 'CDNDomain', {
      value: this.cdn.distributionDomainName,
      description: 'CloudFront CDN Domain',
    });
  }
}
```

**Auth Stack** (`infrastructure/lib/stacks/auth-stack.ts`):
```typescript
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

interface AuthStackProps extends cdk.NestedStackProps {
  env: string;
}

export class AuthStack extends cdk.NestedStack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const isProd = props.env === 'prod';

    // Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `jobgraph-users-${props.env}`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
        givenName: {
          required: true,
          mutable: true,
        },
        familyName: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        role: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(3),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      mfa: isProd ? cognito.Mfa.OPTIONAL : cognito.Mfa.OFF,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      email: cognito.UserPoolEmail.withSES({
        fromEmail: 'noreply@jobgraph.com',
        fromName: 'JobGraph',
        sesRegion: 'us-east-1',
      }),
    });

    // User Pool Client
    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: `jobgraph-web-client-${props.env}`,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          isProd ? 'https://jobgraph.com/callback' : 'http://localhost:5173/callback',
        ],
        logoutUrls: [
          isProd ? 'https://jobgraph.com/logout' : 'http://localhost:5173/logout',
        ],
      },
      preventUserExistenceErrors: true,
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.minutes(60),
      idTokenValidity: cdk.Duration.minutes(60),
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });
  }
}
```

---

## Week 28: Service Migration (4.2)

### Day 1-2: Dockerize All Services

**Base Dockerfile** (`backend/services/auth-service/Dockerfile`):
```dockerfile
# Multi-stage build for optimal image size
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/common/package*.json backend/common/
COPY backend/services/auth-service/package*.json backend/services/auth-service/

# Install dependencies
RUN npm ci

# Copy source code
COPY backend/common/ backend/common/
COPY backend/services/auth-service/ backend/services/auth-service/

# Build common package
WORKDIR /app/backend/common
RUN npm run build

# Build service
WORKDIR /app/backend/services/auth-service
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
COPY backend/common/package*.json backend/common/
COPY backend/services/auth-service/package*.json backend/services/auth-service/

RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/backend/common/dist /app/backend/common/dist
COPY --from=builder /app/backend/services/auth-service/dist /app/backend/services/auth-service/dist

# Set environment
ENV NODE_ENV=production
WORKDIR /app/backend/services/auth-service

# Run as non-root user
USER node

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

**Build and Push Script** (`scripts/build-and-push-images.sh`):
```bash
#!/bin/bash

set -e

AWS_REGION="us-east-1"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
ENV=${1:-dev}

# Login to ECR
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}

# Services to build
SERVICES=("auth-service" "profile-service" "job-service" "skills-service" "matching-service" "notification-service" "interview-service")

for SERVICE in "${SERVICES[@]}"; do
  echo "Building ${SERVICE}..."

  # Create ECR repository if it doesn't exist
  aws ecr describe-repositories --repository-names jobgraph-${SERVICE} --region ${AWS_REGION} || \
    aws ecr create-repository --repository-name jobgraph-${SERVICE} --region ${AWS_REGION}

  # Build Docker image
  docker build \
    -t jobgraph-${SERVICE}:latest \
    -t ${ECR_REGISTRY}/jobgraph-${SERVICE}:${ENV}-latest \
    -t ${ECR_REGISTRY}/jobgraph-${SERVICE}:${ENV}-${GIT_SHA:-local} \
    -f backend/services/${SERVICE}/Dockerfile \
    .

  # Push to ECR
  docker push ${ECR_REGISTRY}/jobgraph-${SERVICE}:${ENV}-latest
  docker push ${ECR_REGISTRY}/jobgraph-${SERVICE}:${ENV}-${GIT_SHA:-local}

  echo "✓ ${SERVICE} built and pushed"
done

echo "All services built and pushed successfully!"
```

### Day 3-4: Database Migration

**Migration Script** (`scripts/migrate-to-rds.sh`):
```bash
#!/bin/bash

set -e

echo "Starting database migration to RDS..."

# Get RDS endpoint and credentials from Secrets Manager
RDS_SECRET_ARN=$(aws cloudformation describe-stacks \
  --stack-name JobGraph-Database-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`DatabaseSecretArn`].OutputValue' \
  --output text)

RDS_CREDENTIALS=$(aws secretsmanager get-secret-value \
  --secret-id ${RDS_SECRET_ARN} \
  --query SecretString \
  --output text)

RDS_HOST=$(echo ${RDS_CREDENTIALS} | jq -r '.host')
RDS_USERNAME=$(echo ${RDS_CREDENTIALS} | jq -r '.username')
RDS_PASSWORD=$(echo ${RDS_CREDENTIALS} | jq -r '.password')
RDS_DATABASE="jobgraph"

# Export local database
echo "Exporting local database..."
docker exec jobgraph-postgres pg_dump -U postgres jobgraph_dev > /tmp/jobgraph_backup.sql

# Import to RDS
echo "Importing to RDS..."
PGPASSWORD=${RDS_PASSWORD} psql \
  -h ${RDS_HOST} \
  -U ${RDS_USERNAME} \
  -d ${RDS_DATABASE} \
  -f /tmp/jobgraph_backup.sql

# Verify migration
echo "Verifying migration..."
TABLE_COUNT=$(PGPASSWORD=${RDS_PASSWORD} psql \
  -h ${RDS_HOST} \
  -U ${RDS_USERNAME} \
  -d ${RDS_DATABASE} \
  -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'")

echo "Migrated ${TABLE_COUNT} tables to RDS"

# Clean up
rm /tmp/jobgraph_backup.sql

echo "✓ Database migration complete!"
```

### Day 5: Deploy to ECS

**Compute Stack** (`infrastructure/lib/stacks/compute-stack.ts`):
```typescript
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elasticloadbalancingv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface ComputeStackProps extends cdk.NestedStackProps {
  vpc: ec2.Vpc;
  database: any;
  redis: any;
  userPool: any;
  buckets: any;
  env: string;
}

export class ComputeStack extends cdk.NestedStack {
  public readonly services: Map<string, ecs.FargateService>;
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    this.services = new Map();
    const isProd = props.env === 'prod';

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: props.vpc,
      clusterName: `jobgraph-cluster-${props.env}`,
      containerInsights: isProd,
    });

    // Application Load Balancer
    const alb = new elasticloadbalancingv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc: props.vpc,
      internetFacing: true,
      loadBalancerName: `jobgraph-alb-${props.env}`,
    });

    // HTTPS Listener (production)
    const httpsListener = alb.addListener('HttpsListener', {
      port: 443,
      certificates: [
        {
          certificateArn: this.node.tryGetContext('certificateArn'),
        },
      ],
    });

    // HTTP Listener (redirect to HTTPS)
    alb.addListener('HttpListener', {
      port: 80,
      defaultAction: elasticloadbalancingv2.ListenerAction.redirect({
        port: '443',
        protocol: 'HTTPS',
        permanent: true,
      }),
    });

    // Service configuration
    const services = [
      { name: 'auth', port: 3000, priority: 10, pathPattern: '/api/v1/auth/*' },
      { name: 'profile', port: 3001, priority: 20, pathPattern: '/api/v1/profiles/*' },
      { name: 'job', port: 3002, priority: 30, pathPattern: '/api/v1/jobs/*' },
      { name: 'skills', port: 3003, priority: 40, pathPattern: '/api/v1/skills/*' },
      { name: 'matching', port: 3004, priority: 50, pathPattern: '/api/v1/matching/*' },
      { name: 'notification', port: 3005, priority: 60, pathPattern: '/api/v1/notifications/*' },
      { name: 'interview', port: 3006, priority: 70, pathPattern: '/api/v1/interviews/*' },
    ];

    // Create each service
    services.forEach((serviceConfig) => {
      const service = this.createFargateService(
        cluster,
        serviceConfig.name,
        serviceConfig.port,
        props,
        isProd
      );

      this.services.set(serviceConfig.name, service);

      // Add target group to ALB
      httpsListener.addTargets(`${serviceConfig.name}Target`, {
        priority: serviceConfig.priority,
        conditions: [
          elasticloadbalancingv2.ListenerCondition.pathPatterns([serviceConfig.pathPattern]),
        ],
        targets: [service],
        healthCheck: {
          path: '/health',
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(5),
          healthyThresholdCount: 2,
          unhealthyThresholdCount: 3,
        },
      });
    });

    this.apiUrl = `https://${alb.loadBalancerDnsName}`;

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      description: 'Load Balancer DNS Name',
    });
  }

  private createFargateService(
    cluster: ecs.Cluster,
    serviceName: string,
    containerPort: number,
    props: ComputeStackProps,
    isProd: boolean
  ): ecs.FargateService {
    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, `${serviceName}TaskDef`, {
      memoryLimitMiB: isProd ? 1024 : 512,
      cpu: isProd ? 512 : 256,
      family: `jobgraph-${serviceName}-${props.env}`,
    });

    // Environment variables
    const environment: Record<string, string> = {
      NODE_ENV: 'production',
      PORT: containerPort.toString(),
      AWS_REGION: cdk.Aws.REGION,
      REDIS_HOST: props.redis.attrRedisEndpointAddress,
      REDIS_PORT: props.redis.attrRedisEndpointPort,
      USER_POOL_ID: props.userPool.userPoolId,
      // Add other environment variables
    };

    // Secrets from Secrets Manager
    const secrets = {
      DATABASE_HOST: ecs.Secret.fromSecretsManager(props.database.secret, 'host'),
      DATABASE_PORT: ecs.Secret.fromSecretsManager(props.database.secret, 'port'),
      DATABASE_NAME: ecs.Secret.fromSecretsManager(props.database.secret, 'dbname'),
      DATABASE_USER: ecs.Secret.fromSecretsManager(props.database.secret, 'username'),
      DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(props.database.secret, 'password'),
    };

    // Container
    const container = taskDefinition.addContainer(`${serviceName}Container`, {
      image: ecs.ContainerImage.fromRegistry(
        `${cdk.Aws.ACCOUNT_ID}.dkr.ecr.${cdk.Aws.REGION}.amazonaws.com/jobgraph-${serviceName}-service:${props.env}-latest`
      ),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: serviceName,
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
      environment,
      secrets,
      healthCheck: {
        command: ['CMD-SHELL', `curl -f http://localhost:${containerPort}/health || exit 1`],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    container.addPortMappings({
      containerPort,
      protocol: ecs.Protocol.TCP,
    });

    // Fargate Service
    const service = new ecs.FargateService(this, `${serviceName}Service`, {
      cluster,
      taskDefinition,
      serviceName: `jobgraph-${serviceName}-${props.env}`,
      desiredCount: isProd ? 2 : 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      circuitBreaker: {
        rollback: true,
      },
      enableExecuteCommand: !isProd, // For debugging
    });

    // Auto Scaling (Production only)
    if (isProd) {
      const scaling = service.autoScaleTaskCount({
        minCapacity: 2,
        maxCapacity: 10,
      });

      scaling.scaleOnCpuUtilization(`${serviceName}CpuScaling`, {
        targetUtilizationPercent: 70,
        scaleInCooldown: cdk.Duration.seconds(60),
        scaleOutCooldown: cdk.Duration.seconds(60),
      });

      scaling.scaleOnMemoryUtilization(`${serviceName}MemoryScaling`, {
        targetUtilizationPercent: 80,
        scaleInCooldown: cdk.Duration.seconds(60),
        scaleOutCooldown: cdk.Duration.seconds(60),
      });
    }

    return service;
  }
}
```

---

## Week 29: CI/CD Pipeline (4.3)

### Day 1-3: GitHub Actions Workflows

**Main Deploy Workflow** (`.github/workflows/deploy.yml`):
```yaml
name: Deploy to AWS

on:
  push:
    branches:
      - main
      - develop
  pull_request:
    branches:
      - main
      - develop

env:
  AWS_REGION: us-east-1
  NODE_VERSION: '18'

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: jobgraph_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        working-directory: backend
        run: npm ci

      - name: Build common package
        working-directory: backend/common
        run: npm run build

      - name: Run linter
        working-directory: backend
        run: npm run lint

      - name: Run tests
        working-directory: backend
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/jobgraph_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret
        run: npm test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info
          flags: backend
          name: backend-coverage

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    strategy:
      matrix:
        service:
          - auth-service
          - profile-service
          - job-service
          - skills-service
          - matching-service
          - notification-service
          - interview-service

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Determine environment
        id: env
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "env=prod" >> $GITHUB_OUTPUT
          else
            echo "env=dev" >> $GITHUB_OUTPUT
          fi

      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: jobgraph-${{ matrix.service }}
          IMAGE_TAG: ${{ steps.env.outputs.env }}-${{ github.sha }}
        run: |
          docker build \
            -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG \
            -t $ECR_REGISTRY/$ECR_REPOSITORY:${{ steps.env.outputs.env }}-latest \
            -f backend/services/${{ matrix.service }}/Dockerfile \
            .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:${{ steps.env.outputs.env }}-latest

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.event_name == 'push'

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Determine environment
        id: env
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "env=prod" >> $GITHUB_OUTPUT
          else
            echo "env=dev" >> $GITHUB_OUTPUT
          fi

      - name: Update ECS services
        run: |
          SERVICES=(
            "auth-service"
            "profile-service"
            "job-service"
            "skills-service"
            "matching-service"
            "notification-service"
            "interview-service"
          )

          for SERVICE in "${SERVICES[@]}"; do
            echo "Updating ${SERVICE}..."
            aws ecs update-service \
              --cluster jobgraph-cluster-${{ steps.env.outputs.env }} \
              --service jobgraph-${SERVICE}-${{ steps.env.outputs.env }} \
              --force-new-deployment \
              --region ${{ env.AWS_REGION }}
          done

      - name: Wait for deployment
        run: |
          SERVICES=(
            "auth-service"
            "profile-service"
            "job-service"
            "skills-service"
            "matching-service"
            "notification-service"
            "interview-service"
          )

          for SERVICE in "${SERVICES[@]}"; do
            echo "Waiting for ${SERVICE} to stabilize..."
            aws ecs wait services-stable \
              --cluster jobgraph-cluster-${{ steps.env.outputs.env }} \
              --services jobgraph-${SERVICE}-${{ steps.env.outputs.env }} \
              --region ${{ env.AWS_REGION }}
          done

          echo "✓ All services deployed successfully!"

      - name: Notify deployment
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Deployment to ${{ steps.env.outputs.env }} ${{ job.status }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### Day 4-5: Infrastructure Deployment Workflow

**CDK Deploy Workflow** (`.github/workflows/infrastructure.yml`):
```yaml
name: Deploy Infrastructure

on:
  push:
    branches:
      - main
      - develop
    paths:
      - 'infrastructure/**'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy'
        required: true
        type: choice
        options:
          - dev
          - prod

jobs:
  deploy-infrastructure:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: infrastructure/package-lock.json

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Install dependencies
        working-directory: infrastructure
        run: npm ci

      - name: Determine environment
        id: env
        run: |
          if [[ "${{ github.event.inputs.environment }}" != "" ]]; then
            echo "env=${{ github.event.inputs.environment }}" >> $GITHUB_OUTPUT
          elif [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "env=prod" >> $GITHUB_OUTPUT
          else
            echo "env=dev" >> $GITHUB_OUTPUT
          fi

      - name: CDK Diff
        working-directory: infrastructure
        run: npx cdk diff --context env=${{ steps.env.outputs.env }}

      - name: CDK Deploy
        working-directory: infrastructure
        run: |
          npx cdk deploy \
            --context env=${{ steps.env.outputs.env }} \
            --require-approval never \
            --all

      - name: Notify deployment
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Infrastructure deployment to ${{ steps.env.outputs.env }} ${{ job.status }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Week 30: Monitoring, Security & Performance (4.4-4.6)

### Day 1-2: Monitoring & Logging

**Monitoring Stack** (`infrastructure/lib/stacks/monitoring-stack.ts`):
```typescript
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

interface MonitoringStackProps extends cdk.NestedStackProps {
  services: Map<string, any>;
  database: any;
  env: string;
}

export class MonitoringStack extends cdk.NestedStack {
  public readonly alarmTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // SNS Topic for alarms
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      displayName: `JobGraph Alarms - ${props.env}`,
      topicName: `jobgraph-alarms-${props.env}`,
    });

    // Subscribe email to alarm topic
    this.alarmTopic.addSubscription(
      new snsSubscriptions.EmailSubscription(
        this.node.tryGetContext('alarmEmail') || 'ops@jobgraph.com'
      )
    );

    // CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `JobGraph-${props.env}`,
    });

    // Add service metrics to dashboard
    this.addServiceMetrics(props);
    this.addDatabaseMetrics(props);
    this.createAlarms(props);
  }

  private addServiceMetrics(props: MonitoringStackProps) {
    const serviceWidgets: cloudwatch.IWidget[] = [];

    props.services.forEach((service, name) => {
      // CPU Utilization
      const cpuWidget = new cloudwatch.GraphWidget({
        title: `${name} - CPU Utilization`,
        left: [
          service.metricCpuUtilization({
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
        height: 6,
      });

      // Memory Utilization
      const memoryWidget = new cloudwatch.GraphWidget({
        title: `${name} - Memory Utilization`,
        left: [
          service.metricMemoryUtilization({
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 12,
        height: 6,
      });

      serviceWidgets.push(cpuWidget, memoryWidget);
    });

    this.dashboard.addWidgets(...serviceWidgets);
  }

  private addDatabaseMetrics(props: MonitoringStackProps) {
    // Database CPU
    const dbCpuWidget = new cloudwatch.GraphWidget({
      title: 'Database CPU Utilization',
      left: [
        props.database.metricCPUUtilization({
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
      ],
      width: 12,
      height: 6,
    });

    // Database Connections
    const dbConnectionsWidget = new cloudwatch.GraphWidget({
      title: 'Database Connections',
      left: [
        props.database.metricDatabaseConnections({
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
      ],
      width: 12,
      height: 6,
    });

    this.dashboard.addWidgets(dbCpuWidget, dbConnectionsWidget);
  }

  private createAlarms(props: MonitoringStackProps) {
    // Service alarms
    props.services.forEach((service, name) => {
      // High CPU alarm
      const cpuAlarm = service
        .metricCpuUtilization()
        .createAlarm(this, `${name}HighCPU`, {
          threshold: 80,
          evaluationPeriods: 2,
          alarmDescription: `${name} service CPU utilization is above 80%`,
        });

      cpuAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

      // High memory alarm
      const memoryAlarm = service
        .metricMemoryUtilization()
        .createAlarm(this, `${name}HighMemory`, {
          threshold: 85,
          evaluationPeriods: 2,
          alarmDescription: `${name} service memory utilization is above 85%`,
        });

      memoryAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
    });

    // Database alarms (already created in DatabaseStack, just reference here)
  }
}
```

### Day 3-4: Security Hardening

**WAF Stack** (`infrastructure/lib/stacks/waf-stack.ts`):
```typescript
import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

interface WafStackProps extends cdk.NestedStackProps {
  albArn: string;
  env: string;
}

export class WafStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: WafStackProps) {
    super(scope, id, props);

    // Web ACL
    const webAcl = new wafv2.CfnWebACL(this, 'WebACL', {
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      rules: [
        // Rate limiting
        {
          name: 'RateLimitRule',
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: 2000, // 2000 requests per 5 minutes
              aggregateKeyType: 'IP',
            },
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule',
          },
        },

        // AWS Managed Rules - Common Rule Set
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 2,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesCommonRuleSet',
          },
        },

        // AWS Managed Rules - Known Bad Inputs
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 3,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesKnownBadInputsRuleSet',
          },
        },

        // SQL Injection Protection
        {
          name: 'AWSManagedRulesSQLiRuleSet',
          priority: 4,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesSQLiRuleSet',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesSQLiRuleSet',
          },
        },

        // Block requests without User-Agent
        {
          name: 'BlockMissingUserAgent',
          priority: 5,
          statement: {
            notStatement: {
              statement: {
                sizeConstraintStatement: {
                  fieldToMatch: {
                    singleHeader: { name: 'user-agent' },
                  },
                  comparisonOperator: 'GT',
                  size: 0,
                  textTransformations: [
                    {
                      priority: 0,
                      type: 'NONE',
                    },
                  ],
                },
              },
            },
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'BlockMissingUserAgent',
          },
        },
      ],
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'JobGraphWebACL',
      },
    });

    // Associate WAF with ALB
    new wafv2.CfnWebACLAssociation(this, 'WebACLAssociation', {
      resourceArn: props.albArn,
      webAclArn: webAcl.attrArn,
    });

    // Outputs
    new cdk.CfnOutput(this, 'WebACLArn', {
      value: webAcl.attrArn,
      description: 'WAF Web ACL ARN',
    });
  }
}
```

### Day 5: Performance Optimization

**Performance Testing Script** (`scripts/load-test.js`):
```javascript
// Using Artillery for load testing
module.exports = {
  config: {
    target: 'https://api.jobgraph.com',
    phases: [
      { duration: 60, arrivalRate: 5, name: 'Warm up' },
      { duration: 120, arrivalRate: 10, name: 'Ramp up load' },
      { duration: 300, arrivalRate: 20, name: 'Sustained load' },
      { duration: 60, arrivalRate: 5, name: 'Ramp down' },
    ],
    payload: {
      path: './test-data.csv',
      fields: ['email', 'password'],
    },
  },
  scenarios: [
    {
      name: 'Search and browse jobs',
      weight: 40,
      flow: [
        {
          get: {
            url: '/api/v1/jobs/search?q=software engineer',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        },
        { think: 2 },
        {
          get: {
            url: '/api/v1/jobs/{{ $randomString() }}',
          },
        },
      ],
    },
    {
      name: 'User authentication',
      weight: 30,
      flow: [
        {
          post: {
            url: '/api/v1/auth/login',
            json: {
              email: '{{ email }}',
              password: '{{ password }}',
            },
            capture: {
              json: '$.data.token',
              as: 'authToken',
            },
          },
        },
        {
          get: {
            url: '/api/v1/profiles/candidate',
            headers: {
              Authorization: 'Bearer {{ authToken }}',
            },
          },
        },
      ],
    },
    {
      name: 'Browse skills',
      weight: 20,
      flow: [
        {
          get: {
            url: '/api/v1/skills?page=1&limit=20',
          },
        },
      ],
    },
    {
      name: 'Get job matches',
      weight: 10,
      flow: [
        {
          post: {
            url: '/api/v1/auth/login',
            json: {
              email: '{{ email }}',
              password: '{{ password }}',
            },
            capture: {
              json: '$.data.token',
              as: 'authToken',
            },
          },
        },
        {
          get: {
            url: '/api/v1/matching/candidate/browse-jobs',
            headers: {
              Authorization: 'Bearer {{ authToken }}',
            },
          },
        },
      ],
    },
  ],
};
```

**Run Load Test**:
```bash
# Install Artillery
npm install -g artillery

# Run load test
artillery run scripts/load-test.js

# Generate HTML report
artillery run --output report.json scripts/load-test.js
artillery report report.json
```

---

## Phase 4 Success Criteria

### Infrastructure
- [ ] All AWS resources deployed via CDK
- [ ] VPC, subnets, and security groups configured
- [ ] RDS PostgreSQL database operational
- [ ] ElastiCache Redis cluster running
- [ ] S3 buckets created with proper permissions
- [ ] Cognito user pool configured
- [ ] ECS cluster with all 7 services running
- [ ] Application Load Balancer routing traffic
- [ ] WAF rules protecting endpoints

### CI/CD
- [ ] GitHub Actions workflows operational
- [ ] Automated testing on all PRs
- [ ] Automated Docker image builds
- [ ] Automated ECS deployments on merge
- [ ] Infrastructure deployments via CDK
- [ ] Rollback capability tested

### Monitoring & Security
- [ ] CloudWatch dashboards showing metrics
- [ ] CloudWatch alarms configured and tested
- [ ] Logs aggregated in CloudWatch Logs
- [ ] SNS notifications for critical alarms
- [ ] WAF rules blocking malicious traffic
- [ ] Secrets stored in Secrets Manager
- [ ] IAM roles following least privilege
- [ ] SSL/TLS certificates configured
- [ ] Database encryption at rest

### Performance
- [ ] API response times < 200ms (p95)
- [ ] Load tested for 1000+ concurrent users
- [ ] Auto-scaling tested and functional
- [ ] Database queries optimized
- [ ] Redis caching implemented
- [ ] CloudFront CDN serving static assets
- [ ] 99.9% uptime SLA met

---

## Next Steps

Once Phase 4 is complete, the platform is ready for **Phase 5: Launch & Scale** with public release, marketing, and continuous improvement.
