import { useState, useEffect } from "react";
import { Pill, Plus, Check, Trash2, Edit } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  time_of_day: string[];
  start_date: string;
  end_date: string | null;
  instructions: string | null;
  prescribing_doctor: string | null;
  active: boolean;
}

interface MedicationLog {
  id: string;
  medication_id: string;
  taken_at: string;
}

export const MedicationTracker = ({ userId }: { userId: string }) => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [inactiveMedications, setInactiveMedications] = useState<Medication[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    frequency: "",
    start_date: new Date().toISOString().split("T")[0],
    instructions: "",
  });

  useEffect(() => {
    loadMedications();
    loadTodayLogs();
    loadInactiveMedications();
  }, [userId]);

  const loadMedications = async () => {
    const { data, error } = await (supabase as any)
      .from("medications")
      .select("*")
      .eq("user_id", userId)
      .eq("active", true)
      .order("name");

    if (error) {
      toast.error("Failed to load medications");
      return;
    }

    setMedications((data as Medication[]) || []);
  };

  const loadInactiveMedications = async () => {
    const { data, error } = await (supabase as any)
      .from("medications")
      .select("*")
      .eq("user_id", userId)
      .eq("active", false)
      .order("end_date", { ascending: false });

    if (error) {
      console.error("Failed to load medication history:", error);
      return;
    }

    setInactiveMedications((data as Medication[]) || []);
  };

  const loadTodayLogs = async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await (supabase as any)
      .from("medication_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("taken_at", `${today}T00:00:00`)
      .lte("taken_at", `${today}T23:59:59`);

    if (error) {
      console.error("Error loading logs:", error);
      return;
    }

    setLogs((data as MedicationLog[]) || []);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.dosage.trim()) {
      toast.error("Please enter name and dosage");
      return;
    }

    if (editingMed) {
      const { error } = await (supabase as any)
        .from("medications")
        .update({
          name: formData.name,
          dosage: formData.dosage,
          frequency: formData.frequency,
          start_date: formData.start_date,
          instructions: formData.instructions || null,
        })
        .eq("id", editingMed.id);

      if (error) {
        toast.error("Failed to update medication");
        return;
      }
      toast.success("Medication updated");
    } else {
      const { error } = await (supabase as any).from("medications").insert({
        user_id: userId,
        name: formData.name,
        dosage: formData.dosage,
        frequency: formData.frequency,
        time_of_day: ["08:00"],
        start_date: formData.start_date,
        instructions: formData.instructions || null,
        active: true,
      });

      if (error) {
        toast.error("Failed to add medication");
        return;
      }
      toast.success("Medication added");
    }

    setIsDialogOpen(false);
    setEditingMed(null);
    setFormData({
      name: "",
      dosage: "",
      frequency: "",
      start_date: new Date().toISOString().split("T")[0],
      instructions: "",
    });
    loadMedications();
  };

  const handleMarkTaken = async (medicationId: string) => {
    const { error } = await (supabase as any).from("medication_logs").insert({
      user_id: userId,
      medication_id: medicationId,
      taken_at: new Date().toISOString(),
    });

    if (error) {
      toast.error("Failed to log medication");
      return;
    }

    toast.success("Medication logged");
    loadTodayLogs();
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any)
      .from("medications")
      .update({ active: false })
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete medication");
      return;
    }

    toast.success("Medication removed");
    loadMedications();
  };

  const isTakenToday = (medId: string) => {
    return logs.some(log => log.medication_id === medId);
  };

  return (
    <>
      <Card className="h-full flex flex-col overflow-hidden bg-gradient-to-br from-card to-card/50 border-primary/10 shadow-[var(--shadow-card)]">
        <div className="p-4 md:p-6 border-b border-primary/10 bg-gradient-to-r from-primary/5 to-transparent flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary-light to-primary-light/80 flex items-center justify-center shadow-md">
                <Pill className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {showHistory ? "Medication History" : "Medications"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {showHistory
                    ? `${inactiveMedications.length} past medications`
                    : `${medications.length} active medications`
                  }
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowHistory(!showHistory)}
                size="sm"
                variant="outline"
                className="flex-1 sm:flex-none"
              >
                {showHistory ? "Show Active" : "Show History"}
              </Button>
              <Button onClick={() => setIsDialogOpen(true)} size="sm" className="bg-gradient-to-r from-primary-light to-primary-light/80 hover:shadow-md transition-all flex-1 sm:flex-none">
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
          {showHistory ? (
            inactiveMedications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Pill className="h-16 w-16 mx-auto mb-3 text-muted-foreground/50" />
                <p className="font-medium">No past medications</p>
                <p className="text-sm mt-2">Your medication history will appear here</p>
              </div>
            ) : (
              inactiveMedications.map((med) => (
                <div
                  key={med.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border opacity-75"
                >
                  <div className="flex-1">
                    <p className="font-medium">{med.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {med.dosage} • {med.frequency}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(med.start_date), "MMM dd, yyyy")} - {med.end_date ? format(new Date(med.end_date), "MMM dd, yyyy") : "Stopped"}
                    </p>
                  </div>
                </div>
              ))
            )
          ) : medications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Pill className="h-16 w-16 mx-auto mb-3 text-muted-foreground/50" />
              <p className="font-medium">No medications added yet</p>
              <p className="text-sm mt-2">Start tracking your medications</p>
            </div>
          ) : (
            medications.map((med) => (
              <div
                key={med.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg bg-secondary/50 border border-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{med.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {med.dosage} • {med.frequency}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {isTakenToday(med.id) ? (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-accent/20 text-accent flex items-center gap-1 whitespace-nowrap">
                      <Check className="h-3 w-3" />
                      Taken
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkTaken(med.id)}
                      className="whitespace-nowrap"
                    >
                      <Check className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Mark Taken</span>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingMed(med);
                      setFormData({
                        name: med.name,
                        dosage: med.dosage,
                        frequency: med.frequency,
                        start_date: med.start_date,
                        instructions: med.instructions || "",
                      });
                      setIsDialogOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(med.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
          </div>
        </div>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMed ? "Edit Medication" : "Add Medication"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Medication Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Lisinopril"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dosage">Dosage</Label>
              <Input
                id="dosage"
                value={formData.dosage}
                onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                placeholder="10mg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Input
                id="frequency"
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                placeholder="Once daily"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                placeholder="Take with food"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="transition-colors hover:bg-destructive hover:text-destructive-foreground"
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingMed ? "Update" : "Add"} Medication
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
