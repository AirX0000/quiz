import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://hawlzgobfzsqwaxfpqva.supabase.co', 'sb_publishable_moND8o3E68eoh_kEkhPk5A_llIok7nO');

async function test(email) {
    console.log(`Testing: ${email}`);
    const { error } = await supabase.auth.signUp({ email, password: 'password123!' });
    if (error) console.log(`Result: ${error.message}`);
    else console.log('Success!');
}

await test("Air@quizblast.app");
await test("аir@quizblast.app"); // Cyrillic a
