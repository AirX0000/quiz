-- ========================================================
-- QuizBlast Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ========================================================

-- 1. Profiles Table (for Roles)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT,
    role TEXT DEFAULT 'teacher' CHECK (role IN ('teacher', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'teacher');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Quizzes Table
CREATE TABLE public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES auth.users(id) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Questions Table
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    answers JSONB NOT NULL,
    correct_index INTEGER NOT NULL,
    keyword TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Results Table (Leaderboard & Analytics)
CREATE TABLE public.results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    correct_count INTEGER NOT NULL,
    wrong_count INTEGER NOT NULL,
    answers_history JSONB, -- Array of objects: {question_id, chosen_index}
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================
-- Row Level Security (RLS) Policies
-- ========================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

-- Profiles: 
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can do anything on profiles" ON public.profiles FOR ALL USING (public.is_admin());

-- Quizzes:
CREATE POLICY "Anyone can read quizzes" ON public.quizzes FOR SELECT USING (true);
CREATE POLICY "Teachers can insert quizzes" ON public.quizzes FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own quizzes" ON public.quizzes FOR UPDATE USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can delete own quizzes" ON public.quizzes FOR DELETE USING (auth.uid() = teacher_id);
CREATE POLICY "Admins can modify any quiz" ON public.quizzes FOR ALL USING (public.is_admin());

-- Questions:
CREATE POLICY "Anyone can read questions" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Teachers can modify their quiz questions" ON public.questions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.quizzes WHERE id = quiz_id AND teacher_id = auth.uid())
);
CREATE POLICY "Admins can modify any question" ON public.questions FOR ALL USING (public.is_admin());

-- Results:
CREATE POLICY "Anyone can read results" ON public.results FOR SELECT USING (true);
CREATE POLICY "Anyone can insert results" ON public.results FOR INSERT WITH CHECK (true);
-- Normally results aren't deleted, but admins can
CREATE POLICY "Admins can modify results" ON public.results FOR ALL USING (public.is_admin());
