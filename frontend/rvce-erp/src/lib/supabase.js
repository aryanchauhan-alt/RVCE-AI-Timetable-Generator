import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const authService = {
    async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data;
    },
    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },
    async getSession() {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    },
};

export const uploadService = {
    async replaceTableData(table, rows) {
        // 1. Delete all existing rows
        // Note: We use .neq('id', 0) as a way to match all rows if ID is always > 0
        const { error: deleteError } = await supabase
            .from(table)
            .delete()
            .neq('id', 0);

        if (deleteError) throw deleteError;

        // 2. Insert new rows in batches of 100
        const batchSize = 100;
        let insertedCount = 0;

        for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            const { data, error: insertError } = await supabase
                .from(table)
                .insert(batch)
                .select();

            if (insertError) throw insertError;
            if (data) insertedCount += data.length;
        }

        return { count: insertedCount };
    }
};
