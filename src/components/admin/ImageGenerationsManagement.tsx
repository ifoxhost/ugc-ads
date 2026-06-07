import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink } from "lucide-react";

interface ImageGeneration {
  id: string;
  email: string;
  image_description: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  generated_image_url: string | null;
}

export const ImageGenerationsManagement = () => {
  const [generations, setGenerations] = useState<ImageGeneration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGenerations = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("image_generations")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);

        if (data) {
          setGenerations(data);
        }
      } catch (error) {
        console.error("Error fetching image generations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchGenerations();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Image Generations</CardTitle>
        <CardDescription>View all image generation requests (last 50)</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {generations.map((gen) => (
              <TableRow key={gen.id}>
                <TableCell className="font-medium">{gen.email}</TableCell>
                <TableCell className="max-w-xs truncate">{gen.image_description}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      gen.status === "completed"
                        ? "default"
                        : gen.status === "processing"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {gen.status}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(gen.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  {gen.generated_image_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(gen.generated_image_url!, "_blank")}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
