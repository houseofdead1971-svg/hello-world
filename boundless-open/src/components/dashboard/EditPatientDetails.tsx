import { useState } from "react";
import { Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PatientData {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  blood_type: string;
  gender: string;
  allergies: string[];
  chronic_conditions: string[];
  emergency_contact?: string;
}

export const EditPatientDetails = ({ 
  patient, 
  onSave 
}: { 
  patient: PatientData;
  onSave: () => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    phone: patient.phone || "",
    emergency_contact: patient.emergency_contact || "",
    allergies: patient.allergies?.join(", ") || "",
    chronic_conditions: patient.chronic_conditions?.join(", ") || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          phone: formData.phone,
          emergency_contact: formData.emergency_contact,
          allergies: formData.allergies.split(",").map(s => s.trim()).filter(Boolean),
          chronic_conditions: formData.chronic_conditions.split(",").map(s => s.trim()).filter(Boolean),
          updated_at: new Date().toISOString(),
        })
        .eq("id", patient.id);

      if (error) throw error;

      toast.success("Patient details updated successfully");
      setEditing(false);
      onSave();
    } catch (error) {
      console.error("Error updating patient:", error);
      toast.error("Failed to update patient details");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Edit Patient Details</span>
          {!editing ? (
            <Button size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              disabled={!editing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergency_contact">Emergency Contact</Label>
            <Input
              id="emergency_contact"
              value={formData.emergency_contact}
              onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
              disabled={!editing}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="allergies">Allergies (comma-separated)</Label>
          <Textarea
            id="allergies"
            value={formData.allergies}
            onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
            disabled={!editing}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="chronic_conditions">Chronic Conditions (comma-separated)</Label>
          <Textarea
            id="chronic_conditions"
            value={formData.chronic_conditions}
            onChange={(e) => setFormData({ ...formData, chronic_conditions: e.target.value })}
            disabled={!editing}
            rows={2}
          />
        </div>
      </CardContent>
    </Card>
  );
};
