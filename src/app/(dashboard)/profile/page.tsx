/**
 * Profile Page
 *
 * The signed-in user's own profile: name, phone and password.
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/shared/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { isOperationsRoleName } from '@/shared/lib/auth';
import { getMyProfile } from '@/features/auth/actions/profile';
import { ProfileDetailsForm } from '@/features/auth/components/ProfileDetailsForm';
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Profile | Gesher Distribution',
  description: 'Manage your profile settings',
};

// ============================================
// PAGE
// ============================================

export default async function ProfilePage() {
  const result = await getMyProfile();
  if (!result.success || !result.data) {
    redirect('/login');
  }

  const profile = result.data;
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase() || profile.email.slice(0, 2).toUpperCase();
  const isActive = profile.status === 'active';
  const home = isOperationsRoleName(profile.roleName)
    ? { label: 'Operations', href: '/operations' }
    : { label: 'Dashboard', href: '/dashboard' };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Profile"
        description="Manage your personal information and password"
        breadcrumbs={[home, { label: 'Profile' }]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Overview */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your profile information</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <h3 className="mt-4 text-lg font-semibold">{fullName || profile.email}</h3>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            {profile.roleName && <p className="mt-1 text-sm text-muted-foreground">{profile.roleName}</p>}
            <div className="mt-4 flex items-center gap-2">
              <span
                className={
                  isActive
                    ? 'inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary'
                    : 'inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground'
                }
              >
                {profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Profile Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your personal details here</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileDetailsForm
              email={profile.email}
              firstName={profile.firstName}
              lastName={profile.lastName}
              phone={profile.phone}
            />
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your password to keep your account secure</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
