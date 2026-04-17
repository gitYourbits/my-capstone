import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { issueAPI, locationAPI, categoryAPI, getAuthToken } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const EditIssue = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [states, setStates] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    state: "",
    district: "",
    city: "",
    scope: "city",
    tags: "",
    is_anonymous: false,
  });

  useEffect(() => {
    if (!getAuthToken()) {
      navigate("/login");
      return;
    }
    loadAll();
  }, [id]);

  useEffect(() => {
    if (formData.state) {
      locationAPI.getDistricts(parseInt(formData.state)).then((data) => setDistricts(Array.isArray(data) ? data : []));
    } else {
      setDistricts([]);
      setCities([]);
    }
  }, [formData.state]);

  useEffect(() => {
    if (formData.district) {
      locationAPI.getCities(parseInt(formData.district)).then((data) => setCities(Array.isArray(data) ? data : []));
    } else {
      setCities([]);
    }
  }, [formData.district]);

  const loadAll = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const [issue, statesData, categoriesData] = await Promise.all([
        issueAPI.getById(parseInt(id)),
        locationAPI.getStates(),
        categoryAPI.getAll(),
      ]);

      if (!issue.is_owner) {
        toast({
          title: "Not allowed",
          description: "You can only edit your own issues.",
          variant: "destructive",
        });
        navigate(`/issue/${id}`);
        return;
      }

      setStates(Array.isArray(statesData) ? statesData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);

      const tagsText = Array.isArray(issue.tags) ? issue.tags.map((t: any) => t.name).join(", ") : "";
      setFormData({
        title: issue.title || "",
        description: issue.description || "",
        category: issue.category?.id ? String(issue.category.id) : "",
        state: issue.location?.state?.id ? String(issue.location.state.id) : "",
        district: issue.location?.district?.id ? String(issue.location.district.id) : "",
        city: issue.location?.city?.id ? String(issue.location.city.id) : "",
        scope: issue.scope || "city",
        tags: tagsText,
        is_anonymous: !!issue.is_anonymous,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load issue",
        variant: "destructive",
      });
      navigate("/profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || isSaving) return;
    setIsSaving(true);
    try {
      const tags = formData.tags.split(",").map((t) => t.trim()).filter(Boolean);
      await issueAPI.update(parseInt(id), {
        title: formData.title,
        description: formData.description,
        category: parseInt(formData.category),
        state: formData.state ? parseInt(formData.state) : undefined,
        district: formData.district ? parseInt(formData.district) : undefined,
        city: formData.city ? parseInt(formData.city) : undefined,
        scope: formData.scope,
        tags,
        is_anonymous: formData.is_anonymous,
      });
      toast({
        title: "Issue updated",
        description: "Your changes have been saved.",
      });
      navigate(`/issue/${id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update issue",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container px-4 py-8 text-center text-muted-foreground">Loading issue...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container px-4 py-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Edit Issue</h1>
            <p className="mt-1 text-muted-foreground">Update your post details and tags.</p>
          </div>
          <Card className="p-6 shadow-card border-border/80">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="title">Issue Title *</Label>
                <Input id="title" className="mt-2" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="description">Detailed Description *</Label>
                <Textarea id="description" className="mt-2 min-h-[150px]" required value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>

              <div>
                <Label>Category *</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>State</Label>
                  <Select value={formData.state} onValueChange={(value) => setFormData({ ...formData, state: value, district: "", city: "" })}>
                    <SelectTrigger className="mt-2"><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent>{states.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>District</Label>
                  <Select value={formData.district} onValueChange={(value) => setFormData({ ...formData, district: value, city: "" })}>
                    <SelectTrigger className="mt-2"><SelectValue placeholder="Select district" /></SelectTrigger>
                    <SelectContent>{districts.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>City</Label>
                  <Select value={formData.city} onValueChange={(value) => setFormData({ ...formData, city: value })}>
                    <SelectTrigger className="mt-2"><SelectValue placeholder="Select city" /></SelectTrigger>
                    <SelectContent>{cities.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Scope *</Label>
                <Select value={formData.scope} onValueChange={(value) => setFormData({ ...formData, scope: value })}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="Select scope" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="city">City Level</SelectItem>
                    <SelectItem value="district">District Level</SelectItem>
                    <SelectItem value="state">State Level</SelectItem>
                    <SelectItem value="national">National Level</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input id="tags" className="mt-2" value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                <div>
                  <Label htmlFor="anonymous" className="cursor-pointer">Post Anonymously</Label>
                </div>
                <Switch id="anonymous" checked={formData.is_anonymous} onCheckedChange={(checked) => setFormData({ ...formData, is_anonymous: checked })} />
              </div>

              <div className="flex gap-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(`/issue/${id}`)} disabled={isSaving}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={isSaving}>{isSaving ? "Saving..." : "Save Changes"}</Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EditIssue;

