export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          annual_rate: number | null
          color: string | null
          created_at: string
          current_balance: number
          id: string
          initial_balance: number
          investment_type: string | null
          is_active: boolean
          is_default: boolean
          name: string
          rate_type: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_rate?: number | null
          color?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          investment_type?: string | null
          is_active?: boolean
          is_default?: boolean
          name?: string
          rate_type?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_rate?: number | null
          color?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          investment_type?: string | null
          is_active?: boolean
          is_default?: boolean
          name?: string
          rate_type?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      category_limits: {
        Row: {
          category: string
          created_at: string
          id: string
          limit_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          limit_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          limit_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      challenge_checkins: {
        Row: {
          checkin_date: string
          created_at: string
          id: string
          user_challenge_id: string
          user_id: string
        }
        Insert: {
          checkin_date?: string
          created_at?: string
          id?: string
          user_challenge_id: string
          user_id: string
        }
        Update: {
          checkin_date?: string
          created_at?: string
          id?: string
          user_challenge_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_checkins_user_challenge_id_fkey"
            columns: ["user_challenge_id"]
            isOneToOne: false
            referencedRelation: "user_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          cover_image: string | null
          created_at: string
          description: string | null
          difficulty: string
          duration_days: number
          icon: string | null
          id: string
          is_system: boolean
          name: string
          potential_savings: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cover_image?: string | null
          created_at?: string
          description?: string | null
          difficulty?: string
          duration_days?: number
          icon?: string | null
          id?: string
          is_system?: boolean
          name: string
          potential_savings?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cover_image?: string | null
          created_at?: string
          description?: string | null
          difficulty?: string
          duration_days?: number
          icon?: string | null
          id?: string
          is_system?: boolean
          name?: string
          potential_savings?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      credit_cards: {
        Row: {
          closing_day: number
          color: string | null
          created_at: string
          due_day: number
          id: string
          last_four_digits: string | null
          limit: number
          name: string
          updated_at: string
          used_limit: number
          user_id: string
        }
        Insert: {
          closing_day?: number
          color?: string | null
          created_at?: string
          due_day?: number
          id?: string
          last_four_digits?: string | null
          limit?: number
          name: string
          updated_at?: string
          used_limit?: number
          user_id: string
        }
        Update: {
          closing_day?: number
          color?: string | null
          created_at?: string
          due_day?: number
          id?: string
          last_four_digits?: string | null
          limit?: number
          name?: string
          updated_at?: string
          used_limit?: number
          user_id?: string
        }
        Relationships: []
      }
      custom_categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          is_hidden_default: boolean
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_hidden_default?: boolean
          name: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_hidden_default?: boolean
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_events: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          id: string
          name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date: string
          id?: string
          name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goal_transactions: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          date: string
          goal_id: string
          id: string
          source: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          date?: string
          goal_id: string
          id?: string
          source?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          date?: string
          goal_id?: string
          id?: string
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_transactions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          cover_image: string | null
          created_at: string
          current_amount: number
          deadline: string | null
          id: string
          monthly_contribution: number | null
          name: string
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_image?: string | null
          created_at?: string
          current_amount?: number
          deadline?: string | null
          id?: string
          monthly_contribution?: number | null
          name: string
          target_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_image?: string | null
          created_at?: string
          current_amount?: number
          deadline?: string | null
          id?: string
          monthly_contribution?: number | null
          name?: string
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      health_scores: {
        Row: {
          created_at: string
          factors: Json | null
          id: string
          level: string
          month: number
          score: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          factors?: Json | null
          id?: string
          level?: string
          month: number
          score?: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          factors?: Json | null
          id?: string
          level?: string
          month?: number
          score?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          amount: number
          created_at: string
          id: string
          installment_number: number
          invoice_id: string
          total_installments: number
          transaction_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          installment_number?: number
          invoice_id: string
          total_installments?: number
          transaction_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          installment_number?: number
          invoice_id?: string
          total_installments?: number
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          id: string
          invoice_id: string
          paid_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          paid_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          paid_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          credit_card_id: string
          id: string
          is_paid: boolean
          month: number
          paid_amount: number
          paid_at: string | null
          paid_from_account_id: string | null
          total_amount: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          credit_card_id: string
          id?: string
          is_paid?: boolean
          month: number
          paid_amount?: number
          paid_at?: string | null
          paid_from_account_id?: string | null
          total_amount?: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          credit_card_id?: string
          id?: string
          is_paid?: boolean
          month?: number
          paid_amount?: number
          paid_at?: string | null
          paid_from_account_id?: string | null
          total_amount?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_paid_from_account_id_fkey"
            columns: ["paid_from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      login_days: {
        Row: {
          created_at: string
          id: string
          login_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          login_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          login_date?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          bill_due_days_before: number
          bill_due_reminder: boolean
          category_limit_alert: boolean
          challenge_reminder: boolean
          created_at: string
          goal_reminder: boolean
          id: string
          invoice_reminder: boolean
          low_balance_alert: boolean
          low_balance_threshold: number
          updated_at: string
          user_id: string
          weekly_summary: boolean
        }
        Insert: {
          bill_due_days_before?: number
          bill_due_reminder?: boolean
          category_limit_alert?: boolean
          challenge_reminder?: boolean
          created_at?: string
          goal_reminder?: boolean
          id?: string
          invoice_reminder?: boolean
          low_balance_alert?: boolean
          low_balance_threshold?: number
          updated_at?: string
          user_id: string
          weekly_summary?: boolean
        }
        Update: {
          bill_due_days_before?: number
          bill_due_reminder?: boolean
          category_limit_alert?: boolean
          challenge_reminder?: boolean
          created_at?: string
          goal_reminder?: boolean
          id?: string
          invoice_reminder?: boolean
          low_balance_alert?: boolean
          low_balance_threshold?: number
          updated_at?: string
          user_id?: string
          weekly_summary?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          category: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          related_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          has_account: boolean
          has_card: boolean
          has_completed_profile: boolean
          has_fixed_expenses: boolean
          has_transactions: boolean
          id: string
          initial_score: number | null
          initial_score_label: string | null
          stripe_customer_id: string | null
          subscription_status: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          has_account?: boolean
          has_card?: boolean
          has_completed_profile?: boolean
          has_fixed_expenses?: boolean
          has_transactions?: boolean
          id: string
          initial_score?: number | null
          initial_score_label?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          has_account?: boolean
          has_card?: boolean
          has_completed_profile?: boolean
          has_fixed_expenses?: boolean
          has_transactions?: boolean
          id?: string
          initial_score?: number | null
          initial_score_label?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recurring_exclusions: {
        Row: {
          created_at: string
          id: string
          month: number
          transaction_id: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          transaction_id: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          transaction_id?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_exclusions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category: string
          created_at: string
          credit_card_id: string | null
          date: string
          id: string
          installment_current: number | null
          installments: number | null
          name: string
          observation: string | null
          parent_transaction_id: string | null
          payment_method: string
          recurrence_type: string
          status: string
          time: string | null
          to_account_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category: string
          created_at?: string
          credit_card_id?: string | null
          date?: string
          id?: string
          installment_current?: number | null
          installments?: number | null
          name: string
          observation?: string | null
          parent_transaction_id?: string | null
          payment_method?: string
          recurrence_type?: string
          status?: string
          time?: string | null
          to_account_id?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string
          created_at?: string
          credit_card_id?: string | null
          date?: string
          id?: string
          installment_current?: number | null
          installments?: number | null
          name?: string
          observation?: string | null
          parent_transaction_id?: string | null
          payment_method?: string
          recurrence_type?: string
          status?: string
          time?: string | null
          to_account_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_parent_transaction_id_fkey"
            columns: ["parent_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_challenges: {
        Row: {
          challenge_id: string
          completed_at: string | null
          created_at: string
          id: string
          progress: number
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          progress?: number
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_invoice_period: {
        Args: { p_closing_day: number; p_purchase_date: string }
        Returns: {
          inv_month: number
          inv_year: number
        }[]
      }
      get_or_create_invoice: {
        Args: {
          p_credit_card_id: string
          p_month: number
          p_user_id: string
          p_year: number
        }
        Returns: string
      }
      materialize_recurring_invoice_items: {
        Args: { p_month: number; p_user_id: string; p_year: number }
        Returns: undefined
      }
      recalc_credit_card_used_limit: {
        Args: { p_credit_card_id: string }
        Returns: undefined
      }
      recalc_invoice_total: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
