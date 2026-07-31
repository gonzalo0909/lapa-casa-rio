// lapa-casa-hostel/frontend/src/components/admin/ical-settings.tsx

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Trash2, RefreshCw, Download, Calendar, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

/**
 * @interface ICalFeed
 * @description Represents an external iCal feed configuration
 */
interface ICalFeed {
  id: string;
  name: string;
  url: string;
  roomId: string;
  platform: 'airbnb' | 'booking' | 'expedia' | 'vrbo' | 'custom';
  isActive: boolean;
  lastSync?: string;
  syncStatus?: 'success' | 'error' | 'pending';
  errorMessage?: string;
  bookingsImported?: number;
}

/**
 * @interface Room
 * @description Room selection interface
 */
interface Room {
  id: string;
  name: string;
  type: string;
}

/**
 * @interface SyncStats
 * @description Statistics from sync operations
 */
interface SyncStats {
  totalFeeds: number;
  activeFeeds: number;
  lastSyncTime?: string;
  bookingsImported: number;
  errors: number;
}

/**
 * @component ICalSettings
 * @description Admin component for managing iCal feed integrations with OTAs
 * 
 * Features:
 * - Add/remove iCal feeds from multiple OTAs
 * - Manual and automatic sync configuration
 * - Export calendar links for each room
 * - Sync status monitoring
 * - Error handling and reporting
 * 
 * @returns {JSX.Element} iCal settings management interface
 */
export default function ICalSettings() {
  const [feeds, setFeeds] = useState<ICalFeed[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [stats, setStats] = useState<SyncStats>({ totalFeeds: 0, activeFeeds: 0, bookingsImported: 0, errors: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New feed form state
  const [newFeed, setNewFeed] = useState({
    name: '',
    url: '',
    roomId: '',
    platform: 'custom' as ICalFeed['platform']
  });

  // Auto-sync settings
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState(60); // minutes

  /**
   * @function fetchFeeds
   * @description Loads all configured iCal feeds
   */
  const fetchFeeds = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/ical/feeds', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch iCal feeds');
      }

      const data = await response.json();
      setFeeds(data.feeds || []);
      setStats(data.stats || { totalFeeds: 0, activeFeeds: 0, bookingsImported: 0, errors: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feeds');
      console.error('Error fetching feeds:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * @function fetchRooms
   * @description Loads available rooms for feed assignment
   */
  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/admin/rooms', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch rooms');
      }

      const data = await response.json();
      setRooms(data.rooms || []);
    } catch (err) {
      console.error('Error fetching rooms:', err);
    }
  };

  /**
   * @function fetchSettings
   * @description Loads sync configuration settings
   */
  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin/ical/settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) return;

      const data = await response.json();
      setAutoSync(data.autoSync ?? true);
      setSyncInterval(data.syncInterval ?? 60);
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  useEffect(() => {
    fetchFeeds();
    fetchRooms();
    fetchSettings();
  }, []);

  /**
   * @function addFeed
   * @description Adds a new iCal feed configuration
   */
  const addFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newFeed.name || !newFeed.url || !newFeed.roomId) {
      setError('Please fill in all required fields');
      return;
    }

    // Validate URL format
    try {
      new URL(newFeed.url);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/admin/ical/feeds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newFeed)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add feed');
      }

      setSuccess('Feed added successfully');
      setNewFeed({ name: '', url: '', roomId: '', platform: 'custom' });
      fetchFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add feed');
      console.error('Error adding feed:', err);
    }
  };

  /**
   * @function removeFeed
   * @description Removes an iCal feed configuration
   * @param {string} feedId - ID of feed to remove
   */
  const removeFeed = async (feedId: string) => {
    if (!confirm('Are you sure you want to remove this feed?')) return;

    try {
      setError(null);

      const response = await fetch(`/api/admin/ical/feeds/${feedId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to remove feed');
      }

      setSuccess('Feed removed successfully');
      fetchFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove feed');
      console.error('Error removing feed:', err);
    }
  };

  /**
   * @function toggleFeed
   * @description Toggles feed active status
   * @param {string} feedId - ID of feed to toggle
   * @param {boolean} isActive - New active state
   */
  const toggleFeed = async (feedId: string, isActive: boolean) => {
    try {
      setError(null);

      const response = await fetch(`/api/admin/ical/feeds/${feedId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ isActive })
      });

      if (!response.ok) {
        throw new Error('Failed to update feed');
      }

      fetchFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update feed');
      console.error('Error updating feed:', err);
    }
  };

  /**
   * @function syncFeed
   * @description Manually triggers sync for a specific feed
   * @param {string} feedId - ID of feed to sync
   */
  const syncFeed = async (feedId: string) => {
    try {
      setSyncing(true);
      setError(null);

      const response = await fetch(`/api/admin/ical/feeds/${feedId}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Sync failed');
      }

      const result = await response.json();
      setSuccess(`Synced successfully: ${result.bookingsImported || 0} bookings imported`);
      fetchFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      console.error('Error syncing feed:', err);
    } finally {
      setSyncing(false);
    }
  };

  /**
   * @function syncAllFeeds
   * @description Manually triggers sync for all active feeds
   */
  const syncAllFeeds = async () => {
    try {
      setSyncing(true);
      setError(null);

      const response = await fetch('/api/admin/ical/sync-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      const result = await response.json();
      setSuccess(`Sync complete: ${result.totalImported || 0} bookings imported from ${result.feedsSynced || 0} feeds`);
      fetchFeeds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      console.error('Error syncing all feeds:', err);
    } finally {
      setSyncing(false);
    }
  };

  /**
   * @function updateSettings
   * @description Updates auto-sync configuration
   */
  const updateSettings = async () => {
    try {
      setError(null);

      const response = await fetch('/api/admin/ical/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ autoSync, syncInterval })
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      setSuccess('Settings updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
      console.error('Error updating settings:', err);
    }
  };

  /**
   * @function getExportUrl
   * @description Generates export URL for a room's calendar
   * @param {string} roomId - Room ID
   * @returns {string} Export URL
   */
  const getExportUrl = (roomId: string): string => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/ical/export/${roomId}`;
  };

  /**
   * @function copyToClipboard
   * @description Copies text to clipboard
   * @param {string} text - Text to copy
   */
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess('URL copied to clipboard');
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  /**
   * @function getPlatformBadgeColor
   * @description Returns appropriate badge color for platform
   * @param {string} platform - Platform name
   * @returns {string} Badge variant
   */
  const getPlatformBadgeColor = (platform: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (platform) {
      case 'airbnb': return 'destructive';
      case 'booking': return 'default';
      case 'expedia': return 'secondary';
      case 'vrbo': return 'outline';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">iCal Integration</h2>
          <p className="text-muted-foreground">
            Sync bookings from OTAs and export calendars
          </p>
        </div>
        <Button onClick={syncAllFeeds} disabled={syncing || feeds.length === 0}>
          {syncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync All Feeds
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Feeds</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFeeds}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Feeds</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeFeeds}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bookings Imported</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.bookingsImported}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.errors}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="feeds" className="space-y-4">
        <TabsList>
          <TabsTrigger value="feeds">Import Feeds</TabsTrigger>
          <TabsTrigger value="export">Export Calendars</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Import Feeds Tab */}
        <TabsContent value="feeds" className="space-y-4">
          {/* Add New Feed */}
          <Card>
            <CardHeader>
              <CardTitle>Add New Feed</CardTitle>
              <CardDescription>
                Import bookings from external calendars (Airbnb, Booking.com, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={addFeed} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Feed Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Airbnb Room 101"
                      value={newFeed.name}
                      onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="platform">Platform</Label>
                    <select
                      id="platform"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={newFeed.platform}
                      onChange={(e) => setNewFeed({ ...newFeed, platform: e.target.value as ICalFeed['platform'] })}
                    >
                      <option value="airbnb">Airbnb</option>
                      <option value="booking">Booking.com</option>
                      <option value="expedia">Expedia</option>
                      <option value="vrbo">VRBO</option>
                      <option value="custom">Custom/Other</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="room">Room *</Label>
                    <select
                      id="room"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={newFeed.roomId}
                      onChange={(e) => setNewFeed({ ...newFeed, roomId: e.target.value })}
                      required
                    >
                      <option value="">Select a room</option>
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name} ({room.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="url">iCal URL *</Label>
                    <Input
                      id="url"
                      type="url"
                      placeholder="https://www.airbnb.com/calendar/ical/..."
                      value={newFeed.url}
                      onChange={(e) => setNewFeed({ ...newFeed, url: e.target.value })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the iCal export URL from your OTA platform
                    </p>
                  </div>
                </div>

                <Button type="submit">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Feed
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Existing Feeds */}
          <Card>
            <CardHeader>
              <CardTitle>Configured Feeds</CardTitle>
              <CardDescription>
                Manage your external calendar feeds
              </CardDescription>
            </CardHeader>
            <CardContent>
              {feeds.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No feeds configured yet. Add your first feed above.
                </p>
              ) : (
                <div className="space-y-4">
                  {feeds.map((feed) => (
                    <div
                      key={feed.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{feed.name}</h4>
                          <Badge variant={getPlatformBadgeColor(feed.platform)}>
                            {feed.platform.toUpperCase()}
                          </Badge>
                          {feed.syncStatus === 'success' && (
                            <Badge variant="outline" className="text-green-600">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Synced
                            </Badge>
                          )}
                          {feed.syncStatus === 'error' && (
                            <Badge variant="destructive">
                              <XCircle className="mr-1 h-3 w-3" />
                              Error
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Room: {rooms.find(r => r.id === feed.roomId)?.name || 'Unknown'}
                        </p>
                        {feed.lastSync && (
                          <p className="text-xs text-muted-foreground">
                            Last sync: {new Date(feed.lastSync).toLocaleString()}
                            {feed.bookingsImported !== undefined && ` (${feed.bookingsImported} bookings)`}
                          </p>
                        )}
                        {feed.errorMessage && (
                          <p className="text-xs text-destructive">{feed.errorMessage}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={feed.isActive}
                          onCheckedChange={(checked) => toggleFeed(feed.id, checked)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => syncFeed(feed.id)}
                          disabled={syncing || !feed.isActive}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeFeed(feed.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Calendars Tab */}
        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Export Calendars</CardTitle>
              <CardDescription>
                Share your availability with OTA platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rooms.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No rooms available
                </p>
              ) : (
                <div className="space-y-4">
                  {rooms.map((room) => {
                    const exportUrl = getExportUrl(room.id);
                    return (
                      <div
                        key={room.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <h4 className="font-semibold">{room.name}</h4>
                          <p className="text-sm text-muted-foreground">{room.type}</p>
                          <code className="text-xs bg-muted px-2 py-1 rounded mt-2 block break-all">
                            {exportUrl}
                          </code>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(exportUrl)}
                        >
                          Copy URL
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Settings</CardTitle>
              <CardDescription>
                Configure automatic synchronization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Automatic Sync</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically sync feeds at regular intervals
                  </p>
                </div>
                <Switch
                  checked={autoSync}
                  onCheckedChange={setAutoSync}
                />
              </div>

              {autoSync && (
                <div className="space-y-2">
                  <Label htmlFor="interval">Sync Interval (minutes)</Label>
                  <Input
                    id="interval"
                    type="number"
                    min="15"
                    max="1440"
                    value={syncInterval}
                    onChange={(e) => setSyncInterval(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum: 15 minutes, Maximum: 24 hours (1440 minutes)
                  </p>
                </div>
              )}

              <Button onClick={updateSettings}>
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ✅ Archivo 1/10 completado
