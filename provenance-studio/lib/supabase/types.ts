/**
 * Types de la base Supabase.
 *
 * Écrits à la main pour refléter `supabase/migrations/`. Régénérez-les après
 * toute migration avec `npm run db:types` (nécessite la CLI Supabase et un
 * projet lié) : la sortie doit être équivalente à ce fichier.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type PlanType = "free" | "pro";
export type MemberRole = "owner" | "member";
export type ProductStatus = "draft" | "ready";
export type TransportMode = "land" | "sea" | "air";
export type RenderFormat = "vertical" | "horizontal";
export type RenderStatus = "queued" | "rendering" | "done" | "failed";

type Timestamps = {
  id: string;
  created_at: string;
  updated_at: string;
};

export type OrganizationRow = Timestamps & {
  name: string;
  slug: string;
  logo_path: string | null;
  brand_color: string;
  plan: PlanType;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

export type OrganizationMemberRow = Timestamps & {
  organization_id: string;
  user_id: string;
  role: MemberRole;
};

export type ProductRow = Timestamps & {
  organization_id: string;
  name: string;
  slug: string;
  end_line: string;
  status: ProductStatus;
  public: boolean;
};

export type StepRow = Timestamps & {
  product_id: string;
  position: number;
  title: string;
  caption: string;
  place_name: string;
  lat: number | null;
  lng: number | null;
  mode: TransportMode;
  photo_path: string | null;
  waypoints: Json;
  duration_seconds: number;
};

export type RenderRow = Timestamps & {
  product_id: string;
  format: RenderFormat;
  status: RenderStatus;
  progress: number;
  video_path: string | null;
  thumbnail_path: string | null;
  error: string | null;
  render_id_provider: string | null;
  watermark: boolean;
  duration_seconds: number | null;
};

export type PublicPageRow = Timestamps & {
  product_id: string;
  slug: string;
  views_count: number;
  qr_scans_count: number;
};

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
type InsertOf<Row extends Timestamps, Defaulted extends keyof Row> = Optional<
  Row,
  Defaulted | keyof Timestamps
>;

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: OrganizationRow;
        Insert: InsertOf<
          OrganizationRow,
          "logo_path" | "brand_color" | "plan" | "stripe_customer_id" | "stripe_subscription_id"
        >;
        Update: Partial<OrganizationRow>;
        Relationships: [];
      };
      organization_members: {
        Row: OrganizationMemberRow;
        Insert: InsertOf<OrganizationMemberRow, "role">;
        Update: Partial<OrganizationMemberRow>;
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: ProductRow;
        Insert: InsertOf<ProductRow, "end_line" | "status" | "public">;
        Update: Partial<ProductRow>;
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      steps: {
        Row: StepRow;
        Insert: InsertOf<
          StepRow,
          | "title"
          | "caption"
          | "place_name"
          | "lat"
          | "lng"
          | "mode"
          | "photo_path"
          | "waypoints"
          | "duration_seconds"
        >;
        Update: Partial<StepRow>;
        Relationships: [
          {
            foreignKeyName: "steps_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      renders: {
        Row: RenderRow;
        Insert: InsertOf<
          RenderRow,
          | "status"
          | "progress"
          | "video_path"
          | "thumbnail_path"
          | "error"
          | "render_id_provider"
          | "watermark"
          | "duration_seconds"
        >;
        Update: Partial<RenderRow>;
        Relationships: [
          {
            foreignKeyName: "renders_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      public_pages: {
        Row: PublicPageRow;
        Insert: InsertOf<PublicPageRow, "views_count" | "qr_scans_count">;
        Update: Partial<PublicPageRow>;
        Relationships: [
          {
            foreignKeyName: "public_pages_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_org_member: { Args: { org_id: string }; Returns: boolean };
      is_org_owner: { Args: { org_id: string }; Returns: boolean };
      is_product_member: { Args: { p_id: string }; Returns: boolean };
      is_org_member_path: { Args: { object_name: string }; Returns: boolean };
      plan_max_products: { Args: { p: PlanType }; Returns: number | null };
      plan_max_steps: { Args: { p: PlanType }; Returns: number };
      increment_public_page_counters: {
        Args: { page_slug: string; from_qr: boolean };
        Returns: undefined;
      };
    };
    Enums: {
      plan_type: PlanType;
      member_role: MemberRole;
      product_status: ProductStatus;
      transport_mode: TransportMode;
      render_format: RenderFormat;
      render_status: RenderStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
