-- Seed Students for admin@school.com tenant
-- Branch ID: 04e1ae26-dbfe-4443-8e0f-2d50d6c68e6b
-- Academic Year: 2026-2027 (17bb7c23-81d1-46ea-b356-fc4922f22b68)
-- Student Role: b67b3f85-ccf0-4270-9a85-f2e12236e6c5

-- Iraqi names in English (common names)
DO $$
DECLARE
    branch_id_val UUID := '04e1ae26-dbfe-4443-8e0f-2d50d6c68e6b';
    academic_year_id_val UUID := '17bb7c23-81d1-46ea-b356-fc4922f22b68';
    student_role_id_val UUID := 'b67b3f85-ccf0-4270-9a85-f2e12236e6c5';
    
    -- Classes
    class1_id UUID := '2f1a9f54-5ff6-412c-9954-bdc8527061d1';
    class2_id UUID := '86a53008-ab55-4d9b-8e26-d08da959dea9';
    class3_id UUID := '8368dc3b-5040-4ee3-9a31-3933c751364e';
    class4_id UUID := '04baf0c8-ae6a-49e9-bd50-d0bcd1115339';
    class5_id UUID := 'af0435f6-60ee-410c-a058-652205a34728';
    
    -- Sections
    section_a_id UUID := 'b3c92545-160c-4202-8eb5-4387a9edecbc';
    section_b_id UUID := '5546f26f-4ca1-4bb1-90f2-18aa4acc84c1';
    section_c_id UUID := '51bf7e80-c274-488b-95ae-ae509a5770e9';
    
    student_user_id UUID;
    student_email TEXT;
    student_password TEXT := 'Student@123'; -- Default password
    student_id_seq INTEGER := 1;
    year_prefix TEXT := '2026';
BEGIN
    -- Students data: (first_name, last_name, class_id, section_id, student_id_suffix)
    FOR student_data IN 
        SELECT * FROM (VALUES
            ('Ahmed', 'Hassan', class1_id, section_a_id, '001'),
            ('Fatima', 'Ali', class1_id, section_a_id, '002'),
            ('Mohammed', 'Ibrahim', class1_id, section_b_id, '003'),
            ('Aisha', 'Mahmoud', class1_id, section_b_id, '004'),
            ('Omar', 'Khalil', class1_id, section_c_id, '005'),
            
            ('Layla', 'Yusuf', class2_id, section_a_id, '001'),
            ('Hassan', 'Salim', class2_id, section_a_id, '002'),
            ('Zainab', 'Nouri', class2_id, section_b_id, '003'),
            ('Ali', 'Rashid', class2_id, section_b_id, '004'),
            ('Mariam', 'Tariq', class2_id, section_c_id, '005'),
            
            ('Khalid', 'Jamil', class3_id, section_a_id, '001'),
            ('Noor', 'Faisal', class3_id, section_a_id, '002'),
            ('Yusuf', 'Adnan', class3_id, section_b_id, '003'),
            ('Sara', 'Bashir', class3_id, section_b_id, '004'),
            ('Ibrahim', 'Karim', class3_id, section_c_id, '005'),
            
            ('Hana', 'Nasser', class4_id, section_a_id, '001'),
            ('Tariq', 'Malik', class4_id, section_a_id, '002'),
            ('Rania', 'Saeed', class4_id, section_b_id, '003'),
            ('Amjad', 'Waleed', class4_id, section_b_id, '004'),
            ('Dina', 'Hakim', class4_id, section_c_id, '005'),
            
            ('Bilal', 'Zaid', class5_id, section_a_id, '001'),
            ('Lina', 'Farid', class5_id, section_a_id, '002'),
            ('Samir', 'Nadim', class5_id, section_b_id, '003'),
            ('Rana', 'Qasim', class5_id, section_b_id, '004'),
            ('Waleed', 'Hamza', class5_id, section_c_id, '005')
        ) AS t(first_name, last_name, class_id, section_id, student_id_suffix)
    LOOP
        -- Generate email
        student_email := LOWER(student_data.first_name || '.' || student_data.last_name || student_id_seq || '@student.school.com');
        student_id_seq := student_id_seq + 1;
        
        -- Create auth user
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            recovery_sent_at,
            last_sign_in_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            student_email,
            crypt(student_password, gen_salt('bf')),
            NOW(),
            NOW(),
            NOW(),
            '{"provider":"email","providers":["email"]}',
            '{}',
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        ) RETURNING id INTO student_user_id;
        
        -- Create profile
        INSERT INTO public.profiles (
            id,
            full_name,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            student_user_id,
            student_data.first_name || ' ' || student_data.last_name,
            true,
            NOW(),
            NOW()
        );
        
        -- Assign to branch
        INSERT INTO public.user_branches (
            user_id,
            branch_id,
            is_primary,
            created_at
        ) VALUES (
            student_user_id,
            branch_id_val,
            false,
            NOW()
        );
        
        -- Assign student role
        INSERT INTO public.user_roles (
            user_id,
            role_id,
            branch_id,
            created_at
        ) VALUES (
            student_user_id,
            student_role_id_val,
            branch_id_val,
            NOW()
        );
        
        -- Create student record
        INSERT INTO public.students (
            user_id,
            branch_id,
            student_id,
            class_id,
            section_id,
            academic_year_id,
            is_active,
            admission_date,
            created_at,
            updated_at
        ) VALUES (
            student_user_id,
            branch_id_val,
            year_prefix || '-' || 
            (SELECT name FROM public.classes WHERE id = student_data.class_id) || '-' ||
            (SELECT name FROM public.sections WHERE id = student_data.section_id) || '-' ||
            student_data.student_id_suffix,
            student_data.class_id,
            student_data.section_id,
            academic_year_id_val,
            true,
            CURRENT_DATE - INTERVAL '30 days' * (RANDOM() * 60 + 1), -- Random admission date within last 2 months
            NOW(),
            NOW()
        );
        
    END LOOP;
    
    RAISE NOTICE 'Successfully seeded 25 students';
END $$;

