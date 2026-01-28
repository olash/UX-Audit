-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ux_issues ENABLE ROW LEVEL SECURITY;

-- Create Policies
-- PROJECTS
CREATE POLICY "Users can view own projects" ON projects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects" ON projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON projects
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON projects
    FOR DELETE USING (auth.uid() = user_id);

-- PAGES 
-- Allow access if the parent project belongs to the user
CREATE POLICY "Users can view pages of own projects" ON pages
    FOR SELECT USING (
        exists (
            select 1 from projects 
            where projects.id = pages.project_id 
            and projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert pages to own projects" ON pages
    FOR INSERT WITH CHECK (
        exists (
            select 1 from projects 
            where projects.id = pages.project_id 
            and projects.user_id = auth.uid()
        )
    );

-- UX ISSUES
-- Allow access if the parent page's project belongs to the user
CREATE POLICY "Users can view issues of own projects" ON ux_issues
    FOR SELECT USING (
        exists (
            select 1 from pages
            join projects on projects.id = pages.project_id
            where pages.id = ux_issues.page_id
            and projects.user_id = auth.uid()
        )
    );
