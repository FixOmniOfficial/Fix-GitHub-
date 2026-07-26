import React, { useState } from 'react';
import { useGetReportStats } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { BarChart2 } from 'lucide-react';

export default function Reports() {
  const [period, setPeriod] = useState<'week'|'month'|'year'|'all'>('month');
  const { data: stats, isLoading } = useGetReportStats({ period });

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            रिपोर्ट्स <span className="text-xl font-normal text-muted-foreground ml-2">Reports & Statistics</span>
          </h1>
          <p className="text-muted-foreground mt-1">व्यापार प्रदर्शन विश्लेषण (Business Performance Analysis)</p>
        </div>
        
        <Select value={period} onValueChange={(val: any) => setPeriod(val)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="अवधि चुनें (Select Period)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">इस सप्ताह (This Week)</SelectItem>
            <SelectItem value="month">इस महीने (This Month)</SelectItem>
            <SelectItem value="year">इस वर्ष (This Year)</SelectItem>
            <SelectItem value="all">सभी (All Time)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-80 w-full" />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>आय रुझान (Revenue Trend)</CardTitle>
              <CardDescription>समय के साथ कमाई (Earnings over time)</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.revenueData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" tickFormatter={value => `₹${value}`} />
                  <RechartsTooltip 
                    formatter={(value) => [`₹${value}`, 'आय (Revenue)']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3} dot={{r: 4, fill: 'hsl(var(--primary))'}} activeDot={{r: 6}} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>भुगतान स्थिति (Payment Status)</CardTitle>
              <CardDescription>भुगतान का वितरण (Distribution of payments)</CardDescription>
            </CardHeader>
            <CardContent className="h-80 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.jobsByPayment}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="amount"
                    nameKey="paymentStatus"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {stats.jobsByPayment.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={
                        entry.paymentStatus === 'paid' ? 'hsl(var(--chart-2))' : 
                        entry.paymentStatus === 'partial' ? 'hsl(var(--chart-3))' : 
                        'hsl(var(--chart-4))'
                      } />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value) => [`₹${value}`, 'राशि (Amount)']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>कार्य स्थिति (Job Status)</CardTitle>
              <CardDescription>कार्यों की वर्तमान स्थिति (Current status of jobs)</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.jobsByStatus} margin={{ top: 20, right: 20, bottom: 20, left: 0 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <YAxis dataKey="status" type="category" tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" width={100} />
                  <RechartsTooltip 
                    formatter={(value) => [value, 'कार्य (Jobs)']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {stats.jobsByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>शीर्ष उपकरण (Top Appliances)</CardTitle>
              <CardDescription>सर्वाधिक मरम्मत किए जाने वाले उपकरण (Most repaired appliances)</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topAppliances} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="type" tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <RechartsTooltip 
                    formatter={(value) => [value, 'संख्या (Count)']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="text-center py-24 text-muted-foreground border-2 border-dashed rounded-xl bg-card">
          <BarChart2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">डेटा लोड करने में विफल (Failed to load data)</p>
        </div>
      )}
    </div>
  );
}
