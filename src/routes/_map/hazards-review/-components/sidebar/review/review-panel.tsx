/**
 * Review sidebar section: pick a reviewable hazard layer, read/add comments on it. Comments live in the
 * shared warehouse review.* tables (via the review-api), so threads sync with the internal review viewer.
 */
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ReviewComments } from '@/components/review/review-comments';
import { layerToItemId } from '@/lib/review-api';
import { useFetchReviewableLayers } from '@/hooks/use-fetch-reviewable-layers';

function ReviewPanel() {
  const { data: layers = [] } = useFetchReviewableLayers();
  const [layer, setLayer] = useState<string>('');

  return (
    <div className="space-y-2">
      <div className="mb-4">
        <h3 className="text-lg font-medium mb-2">Review Comments</h3>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Layer</CardTitle>
          <CardDescription>Pick a layer under review to read and add comments. Comments sync with the internal review app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Reviewable layer</Label>
            <Select value={layer} onValueChange={setLayer}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Select a layer…" />
              </SelectTrigger>
              <SelectContent>
                {layers.map((l) => (
                  <SelectItem key={l.value} value={l.value} className="text-xs">{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {layer && <ReviewComments itemId={layerToItemId(layer)} label={`Comments — ${layers.find((l) => l.value === layer)?.label ?? layer}`} />}
        </CardContent>
      </Card>
    </div>
  );
}

export default ReviewPanel;
