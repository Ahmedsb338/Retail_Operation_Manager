CREATE TYPE "public"."app_role" AS ENUM('STORE_MANAGER', 'AREA_MANAGER');--> statement-breakpoint
CREATE TABLE "action_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_code" text NOT NULL,
	"staff_member_id" uuid,
	"agent_name" text DEFAULT '' NOT NULL,
	"pillars" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"suggested_actions" text NOT NULL,
	"owner" text DEFAULT '' NOT NULL,
	"start_date" text DEFAULT '' NOT NULL,
	"due_date" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"before_tracking" text DEFAULT '' NOT NULL,
	"after_tracking" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_kpi_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_code" text NOT NULL,
	"staff_member_id" uuid,
	"agent_name" text NOT NULL,
	"sid" text DEFAULT '' NOT NULL,
	"month" text NOT NULL,
	"kpi_name" text NOT NULL,
	"actual" double precision,
	"target" double precision,
	"achievement_percent" double precision,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_rpm_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_code" text NOT NULL,
	"staff_member_id" uuid,
	"agent_name" text NOT NULL,
	"sid" text DEFAULT '' NOT NULL,
	"month" text NOT NULL,
	"pillar" text NOT NULL,
	"actual" double precision,
	"target" double precision,
	"achievement_percent" double precision,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_diagnostic_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_code" text NOT NULL,
	"is_live_ai" boolean DEFAULT false NOT NULL,
	"model_used" text DEFAULT '' NOT NULL,
	"analysis_json" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "area_manager_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"area_manager_id" uuid NOT NULL,
	"area_name" text NOT NULL,
	"branch_code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "assignments_no_all_wildcard" CHECK (length(trim("area_manager_assignments"."area_name")) > 0 AND upper(trim("area_manager_assignments"."area_name")) NOT IN ('ALL', '*', 'ANY'))
);
--> statement-breakpoint
CREATE TABLE "area_managers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"username_normalized" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "app_role" DEFAULT 'AREA_MANAGER' NOT NULL,
	"password_hash" text NOT NULL,
	"must_rotate_password" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"token_version" integer DEFAULT 1 NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "area_managers_username_unique" UNIQUE("username"),
	CONSTRAINT "area_managers_username_normalized_unique" UNIQUE("username_normalized"),
	CONSTRAINT "area_managers_role_locked" CHECK ("area_managers"."role" = 'AREA_MANAGER')
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" text NOT NULL,
	"actor_role" "app_role",
	"actor_identifier" text NOT NULL,
	"branch_code" text,
	"action" text NOT NULL,
	"domain" text NOT NULL,
	"record_id" text,
	"details_json" jsonb,
	"ip_address" text DEFAULT '' NOT NULL,
	CONSTRAINT "audit_log_actor_type_valid" CHECK ("audit_log"."actor_type" IN ('STORE_MANAGER', 'AREA_MANAGER', 'ANONYMOUS', 'SYSTEM_CLI'))
);
--> statement-breakpoint
CREATE TABLE "branch_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_code" text NOT NULL,
	"code_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"token_version" integer DEFAULT 1 NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_rotated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_credentials_branch_code_unique" UNIQUE("branch_code")
);
--> statement-breakpoint
CREATE TABLE "branch_health_configs" (
	"branch_code" text PRIMARY KEY NOT NULL,
	"daily_operations_weight" integer DEFAULT 25 NOT NULL,
	"sales_performance_weight" integer DEFAULT 25 NOT NULL,
	"team_performance_weight" integer DEFAULT 20 NOT NULL,
	"customer_experience_weight" integer DEFAULT 15 NOT NULL,
	"compliance_audits_weight" integer DEFAULT 15 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_health_weights_sum_100" CHECK (("branch_health_configs"."daily_operations_weight" + "branch_health_configs"."sales_performance_weight" + "branch_health_configs"."team_performance_weight" + "branch_health_configs"."customer_experience_weight" + "branch_health_configs"."compliance_audits_weight") = 100)
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"code" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"name" text NOT NULL,
	"name_ar" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"city_ar" text DEFAULT '' NOT NULL,
	"manager_name" text DEFAULT '' NOT NULL,
	"manager_name_ar" text DEFAULT '' NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"business_date" text DEFAULT '' NOT NULL,
	"total_shifts" integer DEFAULT 25 NOT NULL,
	"remaining_shifts" integer DEFAULT 10 NOT NULL,
	"target_daily_revenue" double precision DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branches_store_id_unique" UNIQUE("store_id"),
	CONSTRAINT "branches_name_unique" UNIQUE("name"),
	CONSTRAINT "branches_store_id_equals_code" CHECK ("branches"."store_id" = "branches"."code")
);
--> statement-breakpoint
CREATE TABLE "coaching_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_code" text NOT NULL,
	"staff_member_id" uuid NOT NULL,
	"session_date" text NOT NULL,
	"coach" text NOT NULL,
	"topic" text NOT NULL,
	"agreed_actions" text DEFAULT '' NOT NULL,
	"score_improvement" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_code" text NOT NULL,
	"staff_member_id" uuid,
	"agent_name" text DEFAULT '' NOT NULL,
	"case_number" text NOT NULL,
	"customer_identifier" text DEFAULT '' NOT NULL,
	"date" text NOT NULL,
	"category" text NOT NULL,
	"category_ar" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_repeated" boolean DEFAULT false NOT NULL,
	"repeated_match_criteria" text DEFAULT '' NOT NULL,
	"root_cause" text DEFAULT '' NOT NULL,
	"root_cause_ar" text DEFAULT '' NOT NULL,
	"assigned_owner" text DEFAULT '' NOT NULL,
	"resolution_deadline" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"corrective_action" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_code" text NOT NULL,
	"staff_member_id" uuid,
	"agent_name" text NOT NULL,
	"date" text NOT NULL,
	"action" text NOT NULL,
	"status" text NOT NULL,
	"owner" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "late_opening" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_code" text NOT NULL,
	"staff_member_id" uuid,
	"agent_name" text DEFAULT '' NOT NULL,
	"date" text NOT NULL,
	"planned_opening" text DEFAULT '' NOT NULL,
	"actual_opening" text DEFAULT '' NOT NULL,
	"delay_minutes" integer,
	"reason" text DEFAULT '' NOT NULL,
	"responsible" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "late_opening_delay_non_negative" CHECK ("late_opening"."delay_minutes" IS NULL OR "late_opening"."delay_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pillar_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pillar" text NOT NULL,
	"monthly_target" double precision,
	"unit" text DEFAULT '%' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pillar_targets_pillar_unique" UNIQUE("pillar")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"bucket_key" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_boxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_code" text NOT NULL,
	"box_key" text NOT NULL,
	"name" text NOT NULL,
	"name_ar" text DEFAULT '' NOT NULL,
	"target" double precision DEFAULT 0 NOT NULL,
	"actual" double precision DEFAULT 0 NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"unit_ar" text DEFAULT '' NOT NULL,
	"remaining_working_days" integer DEFAULT 0 NOT NULL,
	"trend" text DEFAULT 'stable' NOT NULL,
	"daily_history_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_code" text NOT NULL,
	"staff_member_id" uuid,
	"agent_name" text NOT NULL,
	"date" text NOT NULL,
	"exception_type" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"approved_by" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"role" "app_role" NOT NULL,
	"branch_code" text,
	"area_manager_id" uuid,
	"token_version" integer NOT NULL,
	"ip_address" text DEFAULT '' NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "sessions_principal_binding" CHECK (("sessions"."role" = 'STORE_MANAGER' AND "sessions"."branch_code" IS NOT NULL AND "sessions"."area_manager_id" IS NULL) OR ("sessions"."role" = 'AREA_MANAGER' AND "sessions"."area_manager_id" IS NOT NULL AND "sessions"."branch_code" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "short_over" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_code" text NOT NULL,
	"staff_member_id" uuid,
	"agent_name" text DEFAULT '' NOT NULL,
	"date" text NOT NULL,
	"short_amount" double precision,
	"over_amount" double precision,
	"net_amount" double precision,
	"remarks" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_code" text NOT NULL,
	"sid" text DEFAULT '' NOT NULL,
	"name" text NOT NULL,
	"name_ar" text DEFAULT '' NOT NULL,
	"role_title" text DEFAULT '' NOT NULL,
	"role_title_ar" text DEFAULT '' NOT NULL,
	"product_knowledge_score" integer,
	"productivity_score" integer,
	"customer_experience_score" integer,
	"coaching_status" text DEFAULT 'needs_coaching' NOT NULL,
	"development_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"coaching_notes" text DEFAULT '' NOT NULL,
	"agreed_actions" text DEFAULT '' NOT NULL,
	"assigned_coach" text DEFAULT '' NOT NULL,
	"follow_up_date" text DEFAULT '' NOT NULL,
	"progress_status" text DEFAULT 'pending' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_kpi_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_code" text NOT NULL,
	"month" text NOT NULL,
	"kpi_name" text NOT NULL,
	"actual" double precision,
	"target" double precision,
	"achievement_percent" double precision,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_rpm_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_code" text NOT NULL,
	"month" text NOT NULL,
	"pillar" text NOT NULL,
	"actual" double precision,
	"target" double precision,
	"achievement_percent" double precision,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_code" text NOT NULL,
	"staff_member_id" uuid,
	"schedule_date" text NOT NULL,
	"schedule_month" text NOT NULL,
	"agent_key" text NOT NULL,
	"agent_name" text NOT NULL,
	"sid" text DEFAULT '' NOT NULL,
	"shift" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_schedules_valid_shift" CHECK ("store_schedules"."shift" IN ('AM', 'PM', 'SUP AM', 'SUP PM', 'FULL', 'OFF'))
);
--> statement-breakpoint
CREATE TABLE "store_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_code" text NOT NULL,
	"staff_member_id" uuid,
	"agent_name" text DEFAULT '' NOT NULL,
	"date" text NOT NULL,
	"title" text NOT NULL,
	"title_ar" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"description_ar" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'store' NOT NULL,
	"subcategory" text DEFAULT '' NOT NULL,
	"owner" text DEFAULT '' NOT NULL,
	"owner_role" text DEFAULT '' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"due_date" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"evidence_text" text DEFAULT '' NOT NULL,
	"history_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_configs" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "target_calculator_states" (
	"branch_code" text PRIMARY KEY NOT NULL,
	"items_json" jsonb NOT NULL,
	"weights_json" jsonb NOT NULL,
	"red_sales_today" text DEFAULT '0' NOT NULL,
	"red_sales_target" text DEFAULT '0' NOT NULL,
	"daily_trend_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_shifts" integer DEFAULT 25 NOT NULL,
	"remaining_shifts" integer DEFAULT 10 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tnps_agent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_code" text NOT NULL,
	"staff_member_id" uuid,
	"agent_name" text NOT NULL,
	"sid" text DEFAULT '' NOT NULL,
	"month" text NOT NULL,
	"score" double precision,
	"benchmark" double precision,
	"achievement_percent" double precision,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tnps_store_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_code" text NOT NULL,
	"record_type" text DEFAULT 'monthly_log' NOT NULL,
	"month" text NOT NULL,
	"business_date" text DEFAULT '' NOT NULL,
	"agent_name" text DEFAULT '' NOT NULL,
	"detractors" integer,
	"passive" integer,
	"promoters" integer,
	"score" double precision,
	"benchmark" double precision,
	"achievement_percent" double precision,
	"required_promoters" integer,
	"daily_required" integer,
	"agent_rows_json" jsonb,
	"revision_number" integer DEFAULT 1 NOT NULL,
	"updated_by" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tnps_store_record_type_valid" CHECK ("tnps_store_records"."record_type" IN ('monthly_log', 'daily_calc'))
);
--> statement-breakpoint
CREATE TABLE "unconfigured_branches" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_name" text NOT NULL,
	"display_order" integer NOT NULL,
	"status_note" text DEFAULT 'Unconfigured — awaiting verified Branch Code, Manager Name, and Area' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unconfigured_branches_branch_name_unique" UNIQUE("branch_name")
);
--> statement-breakpoint
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_kpi_records" ADD CONSTRAINT "agent_kpi_records_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_kpi_records" ADD CONSTRAINT "agent_kpi_records_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_rpm_records" ADD CONSTRAINT "agent_rpm_records_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_rpm_records" ADD CONSTRAINT "agent_rpm_records_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_diagnostic_snapshots" ADD CONSTRAINT "ai_diagnostic_snapshots_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "area_manager_assignments" ADD CONSTRAINT "area_manager_assignments_area_manager_id_area_managers_id_fk" FOREIGN KEY ("area_manager_id") REFERENCES "public"."area_managers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "area_manager_assignments" ADD CONSTRAINT "area_manager_assignments_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_credentials" ADD CONSTRAINT "branch_credentials_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_health_configs" ADD CONSTRAINT "branch_health_configs_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_sessions" ADD CONSTRAINT "coaching_sessions_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_sessions" ADD CONSTRAINT "coaching_sessions_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_actions" ADD CONSTRAINT "hr_actions_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_actions" ADD CONSTRAINT "hr_actions_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "late_opening" ADD CONSTRAINT "late_opening_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "late_opening" ADD CONSTRAINT "late_opening_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_boxes" ADD CONSTRAINT "sales_boxes_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_area_manager_id_area_managers_id_fk" FOREIGN KEY ("area_manager_id") REFERENCES "public"."area_managers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_over" ADD CONSTRAINT "short_over_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_over" ADD CONSTRAINT "short_over_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_kpi_records" ADD CONSTRAINT "store_kpi_records_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_rpm_records" ADD CONSTRAINT "store_rpm_records_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_schedules" ADD CONSTRAINT "store_schedules_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_schedules" ADD CONSTRAINT "store_schedules_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_tasks" ADD CONSTRAINT "store_tasks_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_tasks" ADD CONSTRAINT "store_tasks_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_calculator_states" ADD CONSTRAINT "target_calculator_states_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tnps_agent_records" ADD CONSTRAINT "tnps_agent_records_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tnps_agent_records" ADD CONSTRAINT "tnps_agent_records_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tnps_store_records" ADD CONSTRAINT "tnps_store_records_branch_code_branches_code_fk" FOREIGN KEY ("branch_code") REFERENCES "public"."branches"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_action_plans_branch_dates" ON "action_plans" USING btree ("branch_code","start_date","due_date");--> statement-breakpoint
CREATE INDEX "idx_action_plans_branch_status" ON "action_plans" USING btree ("branch_code","status");--> statement-breakpoint
CREATE INDEX "idx_agent_kpi_branch_month_name" ON "agent_kpi_records" USING btree ("branch_code","month","kpi_name");--> statement-breakpoint
CREATE INDEX "idx_agent_kpi_branch_sid" ON "agent_kpi_records" USING btree ("branch_code","sid");--> statement-breakpoint
CREATE INDEX "idx_agent_rpm_branch_month_pillar" ON "agent_rpm_records" USING btree ("branch_code","month","pillar");--> statement-breakpoint
CREATE INDEX "idx_agent_rpm_branch_sid" ON "agent_rpm_records" USING btree ("branch_code","sid");--> statement-breakpoint
CREATE INDEX "idx_ai_diagnostics_branch_generated" ON "ai_diagnostic_snapshots" USING btree ("branch_code","generated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_area_assignment_area_only" ON "area_manager_assignments" USING btree ("area_manager_id","area_name") WHERE "area_manager_assignments"."branch_code" IS NULL AND "area_manager_assignments"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_area_assignment_branch" ON "area_manager_assignments" USING btree ("area_manager_id","branch_code") WHERE "area_manager_assignments"."branch_code" IS NOT NULL AND "area_manager_assignments"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_assignments_manager_active" ON "area_manager_assignments" USING btree ("area_manager_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_assignments_area_name" ON "area_manager_assignments" USING btree ("area_name");--> statement-breakpoint
CREATE INDEX "idx_area_managers_active" ON "area_managers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_audit_log_occurred_at" ON "audit_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_branch_domain" ON "audit_log" USING btree ("branch_code","domain");--> statement-breakpoint
CREATE INDEX "idx_audit_log_action" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_branch_credentials_active" ON "branch_credentials" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_branches_area" ON "branches" USING btree ("area");--> statement-breakpoint
CREATE INDEX "idx_branches_active" ON "branches" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_coaching_branch_staff" ON "coaching_sessions" USING btree ("branch_code","staff_member_id");--> statement-breakpoint
CREATE INDEX "idx_coaching_date" ON "coaching_sessions" USING btree ("session_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_complaints_branch_case_number" ON "complaints" USING btree ("branch_code","case_number");--> statement-breakpoint
CREATE INDEX "idx_complaints_branch_date_status" ON "complaints" USING btree ("branch_code","date","status");--> statement-breakpoint
CREATE INDEX "idx_hr_actions_branch_date" ON "hr_actions" USING btree ("branch_code","date");--> statement-breakpoint
CREATE INDEX "idx_late_opening_branch_date" ON "late_opening" USING btree ("branch_code","date");--> statement-breakpoint
CREATE INDEX "idx_rate_limits_scope_window" ON "rate_limits" USING btree ("scope","window_start");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sales_boxes_branch_key" ON "sales_boxes" USING btree ("branch_code","box_key");--> statement-breakpoint
CREATE INDEX "idx_schedule_exceptions_branch_date" ON "schedule_exceptions" USING btree ("branch_code","date");--> statement-breakpoint
CREATE INDEX "idx_sessions_branch_code" ON "sessions" USING btree ("branch_code");--> statement-breakpoint
CREATE INDEX "idx_sessions_area_manager_id" ON "sessions" USING btree ("area_manager_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires_at" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_short_over_branch_date" ON "short_over" USING btree ("branch_code","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_staff_branch_sid" ON "staff_members" USING btree ("branch_code","sid") WHERE "staff_members"."sid" <> '';--> statement-breakpoint
CREATE INDEX "idx_staff_branch_name" ON "staff_members" USING btree ("branch_code","name");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_store_kpi_branch_month_name" ON "store_kpi_records" USING btree ("branch_code","month","kpi_name");--> statement-breakpoint
CREATE INDEX "idx_store_kpi_branch_month" ON "store_kpi_records" USING btree ("branch_code","month");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_store_rpm_branch_month_pillar" ON "store_rpm_records" USING btree ("branch_code","month","pillar");--> statement-breakpoint
CREATE INDEX "idx_store_rpm_branch_month" ON "store_rpm_records" USING btree ("branch_code","month");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_store_schedules_cell" ON "store_schedules" USING btree ("branch_code","schedule_date","agent_key");--> statement-breakpoint
CREATE INDEX "idx_store_schedules_branch_month" ON "store_schedules" USING btree ("branch_code","schedule_month");--> statement-breakpoint
CREATE INDEX "idx_store_tasks_branch_status_due" ON "store_tasks" USING btree ("branch_code","status","due_date");--> statement-breakpoint
CREATE INDEX "idx_store_tasks_branch_date" ON "store_tasks" USING btree ("branch_code","date");--> statement-breakpoint
CREATE INDEX "idx_tnps_agent_branch_month" ON "tnps_agent_records" USING btree ("branch_code","month");--> statement-breakpoint
CREATE INDEX "idx_tnps_agent_branch_sid" ON "tnps_agent_records" USING btree ("branch_code","sid");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tnps_store_daily_calc" ON "tnps_store_records" USING btree ("branch_code","business_date") WHERE "tnps_store_records"."record_type" = 'daily_calc' AND "tnps_store_records"."business_date" <> '';--> statement-breakpoint
CREATE INDEX "idx_tnps_store_branch_month" ON "tnps_store_records" USING btree ("branch_code","month");--> statement-breakpoint
CREATE INDEX "idx_unconfigured_branches_order" ON "unconfigured_branches" USING btree ("display_order");