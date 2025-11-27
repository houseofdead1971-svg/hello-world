import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, Lock, Bell, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  
  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  
  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [medicationReminders, setMedicationReminders] = useState(true);
  const [appointmentAlerts, setAppointmentAlerts] = useState(true);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Doctor availability
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [availabilitySaving, setAvailabilitySaving] = useState<boolean>(false);

  // Session information
  const [sessionInfo, setSessionInfo] = useState<{
    email?: string;
    lastSignIn?: string;
    browser?: string;
    device?: string;
  }>({});

  // Load notification preferences on mount
  useEffect(() => {
    loadUserRole();
    loadNotificationPreferences();
    loadSessionInfo();
    if (userRole === "doctor") {
      loadDoctorAvailability();
    }
  }, [userRole]);

  const loadUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      if (data) setUserRole(data.role);
    } catch (error) {
      console.error("Error loading user role:", error);
    }
  };

  const loadNotificationPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) {
        // If no preferences exist, create default ones
        if (error.code === "PGRST116") {
          const { error: insertError } = await supabase
            .from("notification_preferences")
            .insert({ user_id: user.id });
          
          if (insertError) throw insertError;
        } else {
          throw error;
        }
      } else if (data) {
        setEmailNotifications(data.email_notifications);
        setMedicationReminders(data.medication_reminders);
        setAppointmentAlerts(data.appointment_alerts);
      }
    } catch (error) {
      console.error("Error loading notification preferences:", error);
      toast.error("Failed to load notification preferences");
    }
  };

  const loadSessionInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userAgent = navigator.userAgent;
      const browserInfo = userAgent.split(" ").slice(-2).join(" ");
      const deviceInfo = /Mobile|Android|iPhone/.test(userAgent) ? "Mobile" : "Desktop";
      
      const lastSignIn = user.last_sign_in_at 
        ? new Date(user.last_sign_in_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : "Not available";

      setSessionInfo({
        email: user.email,
        lastSignIn,
        browser: browserInfo,
        device: deviceInfo
      });
    } catch (error) {
      console.error("Error loading session info:", error);
    }
  };

  const loadDoctorAvailability = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("doctor_profiles")
        .select("available_for_consultation")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.warn("Doctor profile not found, using default", error);
        return;
      }

      if (data) {
        setIsAvailable(data.available_for_consultation);
      }
    } catch (error) {
      console.error("Error loading doctor availability:", error);
    }
  };

  const updateDoctorAvailability = async (value: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("User not authenticated");
        return;
      }

      setAvailabilitySaving(true);

      // Get doctor's ID first
      const { data: doctorData, error: doctorError } = await supabase
        .from("doctor_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (doctorError || !doctorData) {
        throw new Error("Doctor profile not found");
      }

      const { error } = await supabase
        .from("doctor_profiles")
        .update({ available_for_consultation: value })
        .eq("id", doctorData.id);

      if (error) throw error;

      setIsAvailable(value);
      toast.success(
        value
          ? "You are now available for consultations"
          : "You are no longer available for consultations"
      );
    } catch (error: any) {
      console.error("Error updating availability:", error);
      toast.error("Failed to update availability");
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const updateNotificationPreference = async (
    field: string,
    value: boolean
  ) => {
    setLoadingNotifications(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notification_preferences")
        .update({ [field]: value })
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Notification preference updated");
    } catch (error) {
      console.error("Error updating notification preference:", error);
      toast.error("Failed to update notification preference");
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long");
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast.error(error.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("No active session found");
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete account');
      }

      toast.success("Account deleted successfully");
      await supabase.auth.signOut();
      navigate("/");
    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast.error(error.message || "Failed to delete account");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary/30 to-background p-4">
      <div className="max-w-4xl mx-auto py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage your account preferences and security
            </p>
          </div>

          {/* Password Change */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Lock className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Change Password</h2>
            </div>
            
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                <Input
                  id="confirmNewPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </form>
          </Card>

          {/* Notification Preferences */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Notifications</h2>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive updates and alerts via email
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={emailNotifications}
                  onCheckedChange={(checked) => {
                    setEmailNotifications(checked);
                    updateNotificationPreference("email_notifications", checked);
                  }}
                  disabled={loadingNotifications}
                />
              </div>

              <Separator />

              {/* Only show medication reminders for patients */}
              {userRole === 'patient' && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="medication-reminders">Medication Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when it's time to take medication
                      </p>
                    </div>
                    <Switch
                      id="medication-reminders"
                      checked={medicationReminders}
                      onCheckedChange={(checked) => {
                        setMedicationReminders(checked);
                        updateNotificationPreference("medication_reminders", checked);
                      }}
                      disabled={loadingNotifications}
                    />
                  </div>

                  <Separator />
                </>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="appointment-alerts">Appointment Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Reminders for upcoming appointments
                  </p>
                </div>
                <Switch
                  id="appointment-alerts"
                  checked={appointmentAlerts}
                  onCheckedChange={(checked) => {
                    setAppointmentAlerts(checked);
                    updateNotificationPreference("appointment_alerts", checked);
                  }}
                  disabled={loadingNotifications}
                />
              </div>

            </div>
          </Card>

          {/* Doctor Availability */}
          {userRole === "doctor" && (
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Bell className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Availability</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="doctor-availability">Available for Consultations</Label>
                    <p className="text-sm text-muted-foreground">
                      Show up in patient searches when available
                    </p>
                  </div>
                  <Switch
                    id="doctor-availability"
                    checked={isAvailable}
                    onCheckedChange={(checked) => {
                      updateDoctorAvailability(checked);
                    }}
                    disabled={availabilitySaving}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Privacy & Security */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Privacy & Security</h2>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Delete Account</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Permanently delete your account and all associated data
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your
                        account and remove all your data from our servers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete Account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </Card>

          {/* Session Info */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Session Information</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{sessionInfo.email || "Loading..."}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Device:</span>
                <span className="font-medium">{sessionInfo.device || "Loading..."}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Browser:</span>
                <span className="font-medium text-xs">{sessionInfo.browser || "Loading..."}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Sign In:</span>
                <span className="font-medium">{sessionInfo.lastSignIn || "Loading..."}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
