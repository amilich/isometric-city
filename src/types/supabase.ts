// Supabase database types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      regions: {
        Row: {
          id: string;
          name: string;
          creator_city_id: string | null;
          max_slots: number;
          grid_rows: number;
          grid_cols: number;
          is_public: boolean;
          invite_code: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          creator_city_id?: string | null;
          max_slots?: number;
          grid_rows?: number;
          grid_cols?: number;
          is_public?: boolean;
          invite_code?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          creator_city_id?: string | null;
          max_slots?: number;
          grid_rows?: number;
          grid_cols?: number;
          is_public?: boolean;
          invite_code?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      cities: {
        Row: {
          id: string;
          device_token: string;
          region_id: string | null;
          slot_row: number | null;
          slot_col: number | null;
          city_name: string;
          population: number;
          money: number;
          year: number;
          month: number;
          grid_size: number;
          state_blob: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          device_token: string;
          region_id?: string | null;
          slot_row?: number | null;
          slot_col?: number | null;
          city_name: string;
          population?: number;
          money?: number;
          year?: number;
          month?: number;
          grid_size?: number;
          state_blob: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          device_token?: string;
          region_id?: string | null;
          slot_row?: number | null;
          slot_col?: number | null;
          city_name?: string;
          population?: number;
          money?: number;
          year?: number;
          month?: number;
          grid_size?: number;
          state_blob?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cities_region_id_fkey";
            columns: ["region_id"];
            referencedRelation: "regions";
            referencedColumns: ["id"];
          }
        ];
      };
      market_prices: {
        Row: {
          id: string;
          resource_type: string;
          base_price: number;
          current_price: number;
          total_supply: number;
          total_demand: number;
          price_change_24h: number;
          high_24h: number | null;
          low_24h: number | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          resource_type: string;
          base_price: number;
          current_price: number;
          total_supply?: number;
          total_demand?: number;
          price_change_24h?: number;
          high_24h?: number | null;
          low_24h?: number | null;
          updated_at?: string;
        };
        Update: {
          resource_type?: string;
          base_price?: number;
          current_price?: number;
          total_supply?: number;
          total_demand?: number;
          price_change_24h?: number;
          high_24h?: number | null;
          low_24h?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      trade_orders: {
        Row: {
          id: string;
          city_id: string;
          city_name: string;
          resource_type: string;
          order_type: string;
          quantity: number;
          price_per_unit: number;
          filled_quantity: number;
          status: string;
          created_at: string;
          updated_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          city_id: string;
          city_name: string;
          resource_type: string;
          order_type: string;
          quantity: number;
          price_per_unit: number;
          filled_quantity?: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
          expires_at?: string;
        };
        Update: {
          city_id?: string;
          city_name?: string;
          resource_type?: string;
          order_type?: string;
          quantity?: number;
          price_per_unit?: number;
          filled_quantity?: number;
          status?: string;
          updated_at?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
      trade_history: {
        Row: {
          id: string;
          buyer_city_id: string | null;
          seller_city_id: string | null;
          buyer_city_name: string;
          seller_city_name: string;
          resource_type: string;
          quantity: number;
          price_per_unit: number;
          total_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          buyer_city_id?: string | null;
          seller_city_id?: string | null;
          buyer_city_name: string;
          seller_city_name: string;
          resource_type: string;
          quantity: number;
          price_per_unit: number;
          total_amount: number;
          created_at?: string;
        };
        Update: {
          buyer_city_id?: string | null;
          seller_city_id?: string | null;
          buyer_city_name?: string;
          seller_city_name?: string;
          resource_type?: string;
          quantity?: number;
          price_per_unit?: number;
          total_amount?: number;
        };
        Relationships: [];
      };
      city_market_settings: {
        Row: {
          id: string;
          city_id: string;
          resource_type: string;
          auto_sell_enabled: boolean;
          auto_sell_threshold: number;
          auto_sell_min_price: number | null;
          auto_buy_enabled: boolean;
          auto_buy_threshold: number;
          auto_buy_max_price: number | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          city_id: string;
          resource_type: string;
          auto_sell_enabled?: boolean;
          auto_sell_threshold?: number;
          auto_sell_min_price?: number | null;
          auto_buy_enabled?: boolean;
          auto_buy_threshold?: number;
          auto_buy_max_price?: number | null;
          updated_at?: string;
        };
        Update: {
          city_id?: string;
          resource_type?: string;
          auto_sell_enabled?: boolean;
          auto_sell_threshold?: number;
          auto_sell_min_price?: number | null;
          auto_buy_enabled?: boolean;
          auto_buy_threshold?: number;
          auto_buy_max_price?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          channel_type: string;
          channel_id: string | null;
          city_id: string | null;
          city_name: string;
          message: string;
          message_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          channel_type: string;
          channel_id?: string | null;
          city_id?: string | null;
          city_name: string;
          message: string;
          message_type?: string;
          created_at?: string;
        };
        Update: {
          channel_type?: string;
          channel_id?: string | null;
          city_id?: string | null;
          city_name?: string;
          message?: string;
          message_type?: string;
        };
        Relationships: [];
      };
      regional_treasuries: {
        Row: {
          id: string;
          region_id: string;
          balance: number;
          contribution_model: string;
          contribution_rate: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          region_id: string;
          balance?: number;
          contribution_model?: string;
          contribution_rate?: number;
          updated_at?: string;
        };
        Update: {
          region_id?: string;
          balance?: number;
          contribution_model?: string;
          contribution_rate?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "regional_treasuries_region_id_fkey";
            columns: ["region_id"];
            referencedRelation: "regions";
            referencedColumns: ["id"];
          }
        ];
      };
      treasury_transactions: {
        Row: {
          id: string;
          treasury_id: string;
          city_id: string | null;
          city_name: string;
          amount: number;
          transaction_type: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          treasury_id: string;
          city_id?: string | null;
          city_name: string;
          amount: number;
          transaction_type: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          treasury_id?: string;
          city_id?: string | null;
          city_name?: string;
          amount?: number;
          transaction_type?: string;
          description?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "treasury_transactions_treasury_id_fkey";
            columns: ["treasury_id"];
            referencedRelation: "regional_treasuries";
            referencedColumns: ["id"];
          }
        ];
      };
      great_works: {
        Row: {
          id: string;
          region_id: string;
          work_type: string;
          status: string;
          required_money: number;
          required_materials: number;
          required_workers: number;
          contributed_money: number;
          contributed_materials: number;
          contributed_workers: number;
          proposed_by: string | null;
          proposer_name: string;
          voting_ends_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          region_id: string;
          work_type: string;
          status?: string;
          required_money: number;
          required_materials?: number;
          required_workers?: number;
          contributed_money?: number;
          contributed_materials?: number;
          contributed_workers?: number;
          proposed_by?: string | null;
          proposer_name: string;
          voting_ends_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          region_id?: string;
          work_type?: string;
          status?: string;
          required_money?: number;
          required_materials?: number;
          required_workers?: number;
          contributed_money?: number;
          contributed_materials?: number;
          contributed_workers?: number;
          proposed_by?: string | null;
          proposer_name?: string;
          voting_ends_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "great_works_region_id_fkey";
            columns: ["region_id"];
            referencedRelation: "regions";
            referencedColumns: ["id"];
          }
        ];
      };
      great_work_votes: {
        Row: {
          id: string;
          great_work_id: string;
          city_id: string;
          city_name: string;
          vote: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          great_work_id: string;
          city_id: string;
          city_name: string;
          vote: boolean;
          created_at?: string;
        };
        Update: {
          great_work_id?: string;
          city_id?: string;
          city_name?: string;
          vote?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "great_work_votes_great_work_id_fkey";
            columns: ["great_work_id"];
            referencedRelation: "great_works";
            referencedColumns: ["id"];
          }
        ];
      };
      great_work_contributions: {
        Row: {
          id: string;
          great_work_id: string;
          city_id: string;
          city_name: string;
          money_amount: number;
          materials_amount: number;
          workers_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          great_work_id: string;
          city_id: string;
          city_name: string;
          money_amount?: number;
          materials_amount?: number;
          workers_amount?: number;
          created_at?: string;
        };
        Update: {
          great_work_id?: string;
          city_id?: string;
          city_name?: string;
          money_amount?: number;
          materials_amount?: number;
          workers_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "great_work_contributions_great_work_id_fkey";
            columns: ["great_work_id"];
            referencedRelation: "great_works";
            referencedColumns: ["id"];
          }
        ];
      };
      resource_sharing: {
        Row: {
          id: string;
          from_city_id: string;
          to_city_id: string;
          from_city_name: string;
          to_city_name: string;
          region_id: string;
          resource_type: string;
          quantity: number;
          fee_rate: number;
          active: boolean;
          auto_share: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          from_city_id: string;
          to_city_id: string;
          from_city_name: string;
          to_city_name: string;
          region_id: string;
          resource_type: string;
          quantity?: number;
          fee_rate?: number;
          active?: boolean;
          auto_share?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          from_city_id?: string;
          to_city_id?: string;
          from_city_name?: string;
          to_city_name?: string;
          region_id?: string;
          resource_type?: string;
          quantity?: number;
          fee_rate?: number;
          active?: boolean;
          auto_share?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resource_sharing_from_city_id_fkey";
            columns: ["from_city_id"];
            referencedRelation: "cities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resource_sharing_to_city_id_fkey";
            columns: ["to_city_id"];
            referencedRelation: "cities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resource_sharing_region_id_fkey";
            columns: ["region_id"];
            referencedRelation: "regions";
            referencedColumns: ["id"];
          }
        ];
      };
      city_sharing_settings: {
        Row: {
          id: string;
          city_id: string;
          share_power: boolean;
          share_water: boolean;
          share_fire: boolean;
          share_police: boolean;
          share_workers: boolean;
          share_education: boolean;
          min_power_surplus: number;
          min_water_surplus: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          city_id: string;
          share_power?: boolean;
          share_water?: boolean;
          share_fire?: boolean;
          share_police?: boolean;
          share_workers?: boolean;
          share_education?: boolean;
          min_power_surplus?: number;
          min_water_surplus?: number;
          updated_at?: string;
        };
        Update: {
          city_id?: string;
          share_power?: boolean;
          share_water?: boolean;
          share_fire?: boolean;
          share_police?: boolean;
          share_workers?: boolean;
          share_education?: boolean;
          min_power_surplus?: number;
          min_water_surplus?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "city_sharing_settings_city_id_fkey";
            columns: ["city_id"];
            referencedRelation: "cities";
            referencedColumns: ["id"];
          }
        ];
      };
      sharing_transactions: {
        Row: {
          id: string;
          sharing_id: string;
          from_city_id: string;
          to_city_id: string;
          resource_type: string;
          quantity: number;
          amount_paid: number;
          fee_earned: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          sharing_id: string;
          from_city_id: string;
          to_city_id: string;
          resource_type: string;
          quantity: number;
          amount_paid: number;
          fee_earned: number;
          created_at?: string;
        };
        Update: {
          sharing_id?: string;
          from_city_id?: string;
          to_city_id?: string;
          resource_type?: string;
          quantity?: number;
          amount_paid?: number;
          fee_earned?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sharing_transactions_sharing_id_fkey";
            columns: ["sharing_id"];
            referencedRelation: "resource_sharing";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
