"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabOverview } from "./tab-overview";
import { TabDatasets } from "./tab-datasets";
import { TabChecklist } from "./tab-checklist";
import { TabLinks } from "./tab-links";
import { TabScraped } from "./tab-scraped";
import { TabDownloads } from "./tab-downloads";
import type { PipelineResults } from "@/lib/api";

interface ResultTabsProps {
  results: PipelineResults;
  jobId: string | null;
}

export function ResultTabs({ results, jobId }: ResultTabsProps) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="w-full grid grid-cols-6 mb-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="datasets">Datasets</TabsTrigger>
        <TabsTrigger value="checklist">Checklist</TabsTrigger>
        <TabsTrigger value="links">Links</TabsTrigger>
        <TabsTrigger value="scraped">Scraped</TabsTrigger>
        <TabsTrigger value="downloads">Downloads</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <TabOverview results={results} />
      </TabsContent>
      <TabsContent value="datasets">
        <TabDatasets results={results} />
      </TabsContent>
      <TabsContent value="checklist">
        <TabChecklist results={results} jobId={jobId} />
      </TabsContent>
      <TabsContent value="links">
        <TabLinks results={results} />
      </TabsContent>
      <TabsContent value="scraped">
        <TabScraped results={results} />
      </TabsContent>
      <TabsContent value="downloads">
        <TabDownloads results={results} jobId={jobId} />
      </TabsContent>
    </Tabs>
  );
}
