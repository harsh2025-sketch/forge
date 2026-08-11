CREATE SCHEMA IF NOT EXISTS "jwt_scanner";
--> statement-breakpoint
CREATE TYPE "jwt_scanner"."severity" AS ENUM('critical','high','medium','low','info');
--> statement-breakpoint
CREATE TYPE "jwt_scanner"."finding_category" AS ENUM('none_alg','weak_hmac','alg_confusion','expired_claim');
--> statement-breakpoint
CREATE TYPE "jwt_scanner"."job_status" AS ENUM('pending','running','completed','failed','cancelled');
--> statement-breakpoint
CREATE TABLE "jwt_scanner"."projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jwt_scanner"."projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE TABLE "jwt_scanner"."analysis_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" "jwt_scanner"."job_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jwt_scanner"."analysis_jobs" ADD CONSTRAINT "analysis_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "jwt_scanner"."projects"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "jwt_scanner"."analysis_jobs" ADD CONSTRAINT "analysis_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE TABLE "jwt_scanner"."findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"severity" "jwt_scanner"."severity" NOT NULL,
	"category" "jwt_scanner"."finding_category" NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recommendation" text,
	"remediation_code" text,
	"references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jwt_scanner"."findings" ADD CONSTRAINT "findings_job_id_analysis_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "jwt_scanner"."analysis_jobs"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "jwt_scanner"."findings" ADD CONSTRAINT "findings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE TABLE "jwt_scanner"."reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"format" varchar(20) NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jwt_scanner"."reports" ADD CONSTRAINT "reports_job_id_analysis_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "jwt_scanner"."analysis_jobs"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "jwt_scanner"."reports" ADD CONSTRAINT "reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "platform"."organizations"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "analysis_jobs_project_id_idx" ON "jwt_scanner"."analysis_jobs" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "analysis_jobs_organization_id_idx" ON "jwt_scanner"."analysis_jobs" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "findings_job_id_idx" ON "jwt_scanner"."findings" USING btree ("job_id");
--> statement-breakpoint
CREATE INDEX "findings_organization_id_idx" ON "jwt_scanner"."findings" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "reports_job_id_idx" ON "jwt_scanner"."reports" USING btree ("job_id");
