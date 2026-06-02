import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hawlzgobfzsqwaxfpqva.supabase.co';
const SUPABASE_KEY = 'sb_publishable_moND8o3E68eoh_kEkhPk5A_llIok7nO';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    const email = 'Air@quizblast.app';
    const password = 'Air2002!';
    
    console.log('Signing up...');
    let { data, error } = await supabase.auth.signUp({ email, password });
    
    if (error && error.message.includes('User already registered')) {
        console.log('User exists, signing in...');
        const res = await supabase.auth.signInWithPassword({ email, password });
        data = res.data;
        error = res.error;
    }
    
    if (error) {
        console.error('Auth error:', error);
        return;
    }
    
    console.log('Logged in as:', data.user.id);
    
    console.log('Updating role to admin...');
    const { data: updateData, error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', data.user.id);
        
    if (updateError) {
        console.error('Update error:', updateError);
    } else {
        console.log('Success! Account is now admin.');
    }
}

main();
