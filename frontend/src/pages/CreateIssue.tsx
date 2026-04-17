import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { X, Image, Video, Mic, File, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { issueAPI, locationAPI, categoryAPI } from "@/lib/api";
import { getAuthToken } from "@/lib/api";

const CreateIssue = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    state: "",
    district: "",
    city: "",
    scope: "city",
    tags: "",
  });
  const [states, setStates] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraLikelyAvailable, setIsCameraLikelyAvailable] = useState(false);
  const [submissionToken] = useState(
    () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
  );

  useEffect(() => {
    // Check if user is authenticated
    if (!getAuthToken()) {
      toast({
        title: "Authentication required",
        description: "Please login to create an issue",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    loadInitialData();
  }, []);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isMobileLike = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const hasMediaDevices = !!navigator.mediaDevices?.getUserMedia;
    setIsCameraLikelyAvailable(isMobileLike && hasMediaDevices);
  }, []);

  useEffect(() => {
    if (formData.state) {
      loadDistricts(parseInt(formData.state));
    } else {
      setDistricts([]);
      setCities([]);
    }
  }, [formData.state]);

  useEffect(() => {
    if (formData.district) {
      loadCities(parseInt(formData.district));
    } else {
      setCities([]);
    }
  }, [formData.district]);

  const loadInitialData = async () => {
    try {
      console.log('Loading initial data...');
      const [statesData, categoriesData] = await Promise.all([
        locationAPI.getStates(),
        categoryAPI.getAll(),
      ]);
      
      console.log('Raw states data:', statesData);
      console.log('Raw categories data:', categoriesData);
      
      // Ensure we always set arrays
      const statesArray = Array.isArray(statesData) ? statesData : [];
      const categoriesArray = Array.isArray(categoriesData) ? categoriesData : [];
      
      setStates(statesArray);
      setCategories(categoriesArray);
      
      console.log('States set to:', statesArray.length, 'items');
      console.log('Categories set to:', categoriesArray.length, 'items');
    } catch (error: any) {
      console.error('Error loading initial data:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load form data",
        variant: "destructive",
      });
      // Set empty arrays on error
      setStates([]);
      setCategories([]);
    }
  };

  const loadDistricts = async (stateId: number) => {
    try {
      const districtsData = await locationAPI.getDistricts(stateId);
      setDistricts(Array.isArray(districtsData) ? districtsData : []);
    } catch (error) {
      console.error('Failed to load districts:', error);
      setDistricts([]);
    }
  };

  const loadCities = async (districtId: number) => {
    try {
      const citiesData = await locationAPI.getCities(districtId);
      setCities(Array.isArray(citiesData) ? citiesData : []);
    } catch (error) {
      console.error('Failed to load cities:', error);
      setCities([]);
    }
  };

  const fileTypeConfig = {
    image: {
      maxMB: 15,
      accept: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      label: 'image'
    },
    video: {
      maxMB: 80,
      accept: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
      label: 'video'
    },
    audio: {
      maxMB: 30,
      accept: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/ogg'],
      label: 'audio'
    },
  } as const;

  const validateFiles = (files: File[], type: 'image' | 'video' | 'audio') => {
    const config = fileTypeConfig[type];
    const validFiles: File[] = [];
    for (const file of files) {
      const isAllowedType = config.accept.includes(file.type);
      const isAllowedSize = file.size <= config.maxMB * 1024 * 1024;
      if (!isAllowedType) {
        toast({
          title: "Unsupported file format",
          description: `${file.name} is not a valid ${config.label} format.`,
          variant: "destructive",
        });
        continue;
      }
      if (!isAllowedSize) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds ${config.maxMB} MB.`,
          variant: "destructive",
        });
        continue;
      }
      validFiles.push(file);
    }
    return validFiles;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'audio') => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = validateFiles(Array.from(files), type);
      if (newFiles.length > 0) {
        setUploadedFiles([...uploadedFiles, ...newFiles]);
      }
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);

    try {
      // Parse tags
      const tags = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const issueData = {
        title: formData.title,
        description: formData.description,
        is_anonymous: isAnonymous,
        category: parseInt(formData.category),
        state: formData.state ? parseInt(formData.state) : undefined,
        district: formData.district ? parseInt(formData.district) : undefined,
        city: formData.city ? parseInt(formData.city) : undefined,
        scope: formData.scope,
        tags: tags,
        submission_token: submissionToken,
      };

      const response = await issueAPI.create(issueData, uploadedFiles);

      if (response?.duplicate_submission) {
        toast({
          title: "Already submitted",
          description: "Your previous upload already succeeded. Opening that issue.",
        });
      } else {
        toast({
          title: "Success!",
          description: "Your issue has been posted successfully.",
        });
      }
      navigate(response?.id ? `/issue/${response.id}` : "/feed");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create issue. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container px-4 py-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Report an Issue</h1>
            <p className="text-muted-foreground mt-1">
              Share your concern with evidence to bring attention to important matters
            </p>
          </div>

          <Card className="p-6 shadow-card border-border/80">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div>
                <Label htmlFor="title">Issue Title *</Label>
                <Input
                  id="title"
                  placeholder="Brief, descriptive title of the issue"
                  className="mt-2"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Detailed Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Provide detailed information about the issue..."
                  className="mt-2 min-h-[150px]"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              {/* Category */}
              <div>
                <Label>Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length === 0 ? (
                      <SelectItem value="empty" disabled>No categories available</SelectItem>
                    ) : (
                      Array.isArray(categories) && categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Location */}
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>State *</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(value) => setFormData({ ...formData, state: value, district: "", city: "" })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.length === 0 ? (
                        <SelectItem value="empty" disabled>No states available</SelectItem>
                      ) : (
                        Array.isArray(states) && states.map((state) => (
                          <SelectItem key={state.id} value={state.id.toString()}>
                            {state.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>District *</Label>
                  <Select
                    value={formData.district}
                    onValueChange={(value) => setFormData({ ...formData, district: value, city: "" })}
                    disabled={!formData.state}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select district" />
                    </SelectTrigger>
                    <SelectContent>
                      {districts.length === 0 ? (
                        <SelectItem value="empty" disabled>Select a state first</SelectItem>
                      ) : (
                        Array.isArray(districts) && districts.map((district) => (
                          <SelectItem key={district.id} value={district.id.toString()}>
                            {district.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>City *</Label>
                  <Select
                    value={formData.city}
                    onValueChange={(value) => setFormData({ ...formData, city: value })}
                    disabled={!formData.district}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.length === 0 ? (
                        <SelectItem value="empty" disabled>Select a district first</SelectItem>
                      ) : (
                        Array.isArray(cities) && cities.map((city) => (
                          <SelectItem key={city.id} value={city.id.toString()}>
                            {city.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Scope */}
              <div>
                <Label>Scope *</Label>
                <Select
                  value={formData.scope}
                  onValueChange={(value) => setFormData({ ...formData, scope: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="city">City Level</SelectItem>
                    <SelectItem value="district">District Level</SelectItem>
                    <SelectItem value="state">State Level</SelectItem>
                    <SelectItem value="national">National Level</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div>
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  placeholder="e.g., roads, safety, urgent"
                  className="mt-2"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
                <p className="mt-1 text-sm text-muted-foreground">
                  Add relevant tags to help others find your issue (up to 100 chars per tag)
                </p>
              </div>

              {/* Media Upload */}
              <div>
                <Label>Evidence (Photos, Videos, Audio)</Label>
                <div className="mt-2">
                  <div className="flex flex-wrap gap-2">
                    <label>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleFileUpload(e, 'image')}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        asChild
                      >
                        <span>
                          <Image className="h-4 w-4" />
                          Photo
                        </span>
                      </Button>
                    </label>
                    {isCameraLikelyAvailable ? (
                      <label>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handleFileUpload(e, 'image')}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2"
                          asChild
                        >
                          <span>
                            <Camera className="h-4 w-4" />
                            Camera
                          </span>
                        </Button>
                      </label>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        disabled
                        title="Direct camera capture is available on mobile browsers."
                      >
                        <Camera className="h-4 w-4" />
                        Camera (Mobile)
                      </Button>
                    )}
                    <label>
                      <input
                        type="file"
                        accept="video/*"
                        multiple
                        onChange={(e) => handleFileUpload(e, 'video')}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        asChild
                      >
                        <span>
                          <Video className="h-4 w-4" />
                          Video
                        </span>
                      </Button>
                    </label>
                    <label>
                      <input
                        type="file"
                        accept="audio/*"
                        multiple
                        onChange={(e) => handleFileUpload(e, 'audio')}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        asChild
                      >
                        <span>
                          <Mic className="h-4 w-4" />
                          Voice Note
                        </span>
                      </Button>
                    </label>
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {uploadedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3"
                        >
                          <div className="flex items-center gap-2">
                            <File className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{file.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({(file.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Anonymous Toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                <div>
                  <Label htmlFor="anonymous" className="cursor-pointer">
                    Post Anonymously
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Your identity will be hidden from other users
                  </p>
                </div>
                <Switch
                  id="anonymous"
                  checked={isAnonymous}
                  onCheckedChange={setIsAnonymous}
                />
              </div>

              {/* Submit */}
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/feed")}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={isLoading}>
                  {isLoading ? "Posting..." : "Post Issue"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CreateIssue;
