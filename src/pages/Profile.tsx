import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { ProfilePhotoUpload } from "@/components/profile/ProfilePhotoUpload";

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Profile fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [allergies, setAllergies] = useState("");
  const [chronicConditions, setChronicConditions] = useState("");

  // Doctor-specific fields
  const [specialization, setSpecialization] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [hospitalAffiliation, setHospitalAffiliation] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      setUserId(user.id);
      setEmail(user.email || "");

      // Fetch profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        setFullName(profile.full_name || "");
        setPhone(profile.phone || "");
        setAddress(profile.address || "");
        setDateOfBirth(profile.date_of_birth || "");
        setGender(profile.gender || "");
        setBloodType(profile.blood_type || "");
        setEmergencyContact(profile.emergency_contact || "");
        setAllergies(profile.allergies?.join(", ") || "");
        setChronicConditions(profile.chronic_conditions?.join(", ") || "");
        setAvatarUrl(profile.avatar_url);
      }

      // Fetch user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleData) {
        setUserRole(roleData.role);

        // If doctor, fetch doctor profile
        if (roleData.role === "doctor") {
          const { data: doctorProfile } = await supabase
            .from("doctor_profiles")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();

          if (doctorProfile) {
            setSpecialization(doctorProfile.specialization || "");
            setLicenseNumber(doctorProfile.license_number || "");
            setHospitalAffiliation(doctorProfile.hospital_affiliation || "");
          }
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;

    setSaving(true);

    try {
      // Update profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone: phone || null,
          address: address || null,
          date_of_birth: dateOfBirth || null,
          gender: gender || null,
          blood_type: bloodType || null,
          emergency_contact: emergencyContact || null,
          allergies: allergies ? allergies.split(",").map(a => a.trim()) : null,
          chronic_conditions: chronicConditions ? chronicConditions.split(",").map(c => c.trim()) : null,
        })
        .eq("id", userId);

      if (profileError) throw profileError;

      // If doctor, update doctor profile
      if (userRole === "doctor") {
        const { error: doctorError } = await supabase
          .from("doctor_profiles")
          .update({
            specialization,
            license_number: licenseNumber,
            hospital_affiliation: hospitalAffiliation || null,
          })
          .eq("user_id", userId);

        if (doctorError) throw doctorError;
      }

      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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

        <Card className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">My Profile</h1>
              <p className="text-muted-foreground mt-1">
                {userRole === "patient" ? "Patient Profile" : userRole === "doctor" ? "Doctor Profile" : "User Profile"}
              </p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>

          <div className="mb-8 flex justify-center">
            <ProfilePhotoUpload
              userId={userId!}
              currentPhotoUrl={avatarUrl}
              userInitials={fullName.split(' ').map(n => n[0]).join('').toUpperCase() || email[0]?.toUpperCase() || '?'}
              onPhotoUpdate={setAvatarUrl}
            />
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="fullName">{userRole === "doctor" ? (fullName.startsWith('Dr.') ? "Full Name" : "Full Name (Dr. will be added)") : "Full Name"}</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email (Read-only)</Label>
                <Input id="email" value={email} disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>

            {userRole === "patient" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bloodType">Blood Type</Label>
                    <Select value={bloodType} onValueChange={setBloodType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select blood type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A+">A+</SelectItem>
                        <SelectItem value="A-">A-</SelectItem>
                        <SelectItem value="B+">B+</SelectItem>
                        <SelectItem value="B-">B-</SelectItem>
                        <SelectItem value="AB+">AB+</SelectItem>
                        <SelectItem value="AB-">AB-</SelectItem>
                        <SelectItem value="O+">O+</SelectItem>
                        <SelectItem value="O-">O-</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emergencyContact">Emergency Contact</Label>
                    <Input
                      id="emergencyContact"
                      placeholder="Name, Phone"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="allergies">Allergies (comma-separated)</Label>
                  <Textarea
                    id="allergies"
                    placeholder="Peanuts, Penicillin, ..."
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chronicConditions">Chronic Conditions (comma-separated)</Label>
                  <Textarea
                    id="chronicConditions"
                    placeholder="Diabetes, Hypertension, ..."
                    value={chronicConditions}
                    onChange={(e) => setChronicConditions(e.target.value)}
                  />
                </div>
              </>
            )}

            {userRole === "doctor" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="specialization">Specialization</Label>
                    <Input
                      id="specialization"
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="licenseNumber">Medical License Number</Label>
                    <Input
                      id="licenseNumber"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="hospitalAffiliation">Hospital/Clinic Affiliation</Label>
                    <Input
                      id="hospitalAffiliation"
                      value={hospitalAffiliation}
                      onChange={(e) => setHospitalAffiliation(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
