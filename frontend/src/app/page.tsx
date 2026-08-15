import React from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card, { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 w-full border-b border-neutral-200 bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-bold text-primary">Backlink Indexer</span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-sm font-medium text-neutral-600 hover:text-primary">Features</Link>
            <Link href="#how-it-works" className="text-sm font-medium text-neutral-600 hover:text-primary">How It Works</Link>
            <Link href="#discovery" className="text-sm font-medium text-neutral-600 hover:text-primary">Discovery</Link>
            <Link href="#monitoring" className="text-sm font-medium text-neutral-600 hover:text-primary">Monitoring</Link>
            <Link href="#verification" className="text-sm font-medium text-neutral-600 hover:text-primary">Verification</Link>
            <Link href="#pricing" className="text-sm font-medium text-neutral-600 hover:text-primary">Pricing</Link>
            <Link href="#documentation" className="text-sm font-medium text-neutral-600 hover:text-primary">Documentation</Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/login">
              <Button variant="outline">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div className="md:w-1/2 mb-12 md:mb-0">
            <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-6">Get Your Backlinks Discovered Faster</h1>
            <p className="text-xl text-neutral-600 mb-8">
              One platform to validate backlinks, optimize crawl discovery, monitor crawls and verify search engine indexing — without fake indexing promises.
            </p>
            <div className="flex space-x-4">
              <Link href="/signup">
                <Button size="lg">Start Indexing</Button>
              </Link>
              <Link href="/internal">
                <Button variant="outline" size="lg">Explore Dashboard</Button>
              </Link>
            </div>
          </div>
          <div className="md:w-1/2">
            <Card variant="glass" className="p-6">
              <CardHeader>
                <CardTitle>Backlink Indexer Dashboard Preview</CardTitle>
                <CardDescription>Real-time monitoring of your backlink workflow</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-neutral-100 p-4 rounded-lg">
                    <div className="text-neutral-500 text-sm mb-1">Backlinks</div>
                    <div className="text-2xl font-bold text-neutral-900">29</div>
                  </div>
                  <div className="bg-neutral-100 p-4 rounded-lg">
                    <div className="text-neutral-500 text-sm mb-1">Discovered</div>
                    <div className="text-2xl font-bold text-neutral-900">21</div>
                  </div>
                  <div className="bg-neutral-100 p-4 rounded-lg">
                    <div className="text-neutral-500 text-sm mb-1">Crawled</div>
                    <div className="text-2xl font-bold text-neutral-900">16</div>
                  </div>
                  <div className="bg-neutral-100 p-4 rounded-lg">
                    <div className="text-neutral-500 text-sm mb-1">Indexed</div>
                    <div className="text-2xl font-bold text-neutral-900">8</div>
                  </div>
                </div>
                <div className="text-xs text-neutral-500">
                  These are demo values. Actual numbers will vary based on your backlink submissions.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="bg-neutral-100 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center items-center gap-8">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium text-neutral-700">Real backlink validation</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium text-neutral-700">Crawl discovery signals</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium text-neutral-700">Automated monitoring</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium text-neutral-700">Evidence-based verification</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium text-neutral-700">No fake Googlebot</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium text-neutral-700">No guaranteed-indexing claims</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-neutral-900 mb-4">Powerful Features</h2>
          <p className="text-xl text-neutral-600 max-w-3xl mx-auto">
            Everything you need to validate, discover, monitor, and verify your backlinks
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { title: 'Backlink Validation', description: 'Verify the existence and quality of your backlinks before submission' },
            { title: 'Backlink Quality Score', description: 'Quantify the value of each backlink with our proprietary scoring system' },
            { title: 'Crawlability Analysis', description: 'Analyze how easily search engines can crawl your backlinks' },
            { title: 'Canonical Analysis', description: 'Ensure your backlinks point to the correct canonical URL' },
            { title: 'Redirect Tracking', description: 'Monitor any redirects that may affect your backlink performance' },
            { title: 'Discovery Engine', description: 'Optimize your backlinks for search engine discovery' },
            { title: 'RSS Discovery', description: 'Leverage RSS feeds to improve backlink discovery' },
            { title: 'Atom Discovery', description: 'Use Atom feeds to enhance your backlink visibility' },
            { title: 'JSON Feed', description: 'Implement JSON feeds for better backlink indexing' },
            { title: 'WebSub', description: 'Utilize WebSub for real-time backlink updates' },
            { title: 'Retry Scheduler', description: 'Automatically reschedule failed backlink checks' },
            { title: 'Crawl Monitoring', description: 'Track when search engines crawl your backlinks' },
            { title: 'Index Verification', description: 'Verify when your backlinks are actually indexed' },
            { title: 'Domain Intelligence', description: 'Gain insights into domain-level backlink performance' },
            { title: 'Priority Engine', description: 'Prioritize high-value backlinks for faster discovery' },
            { title: 'Experiment Dashboard', description: 'Test different backlink strategies with A/B testing' },
            { title: 'Analytics', description: 'Track the performance of your backlink workflow' },
            { title: 'Secure URL Fetching', description: 'Fetch URLs securely without exposing your infrastructure' },
            { title: 'SSRF Protection', description: 'Protect against Server-Side Request Forgery attacks' },
          ].map((feature, index) => (
            <Card key={index} className="transition-all hover:shadow-lg">
              <CardHeader>
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-600">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-neutral-100 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-neutral-900 mb-4">How It Works</h2>
            <p className="text-xl text-neutral-600 max-w-3xl mx-auto">
              A simple, honest workflow for backlink discovery and verification
            </p>
          </div>
          <div className="hidden md:block">
            <div className="relative">
              <div className="absolute top-1/2 left-0 w-full h-1 bg-neutral-200"></div>
              <div className="relative flex justify-between">
                {[
                  { step: 1, title: 'Submit Backlink', description: 'Add your backlink to our system' },
                  { step: 2, title: 'Validate & Analyze', description: 'Verify the backlink exists and analyze its quality' },
                  { step: 3, title: 'Discover & Monitor', description: 'Optimize discovery and monitor crawl signals' },
                  { step: 4, title: 'Verify Crawl', description: 'Check when search engines actually crawl your backlink' },
                  { step: 5, title: 'Confirm Indexing', description: 'Verify when your backlink is indexed' },
                ].map((item, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <div className="z-10 flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white font-bold mb-4">
                      {item.step}
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-medium text-neutral-900 mb-2">{item.title}</h3>
                      <p className="text-neutral-600">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="md:hidden">
            {[
              { step: 1, title: 'Submit Backlink', description: 'Add your backlink to our system' },
              { step: 2, title: 'Validate & Analyze', description: 'Verify the backlink exists and analyze its quality' },
              { step: 3, title: 'Discover & Monitor', description: 'Optimize discovery and monitor crawl signals' },
              { step: 4, title: 'Verify Crawl', description: 'Check when search engines actually crawl your backlink' },
              { step: 5, title: 'Confirm Indexing', description: 'Verify when your backlink is indexed' },
            ].map((item, index) => (
              <div key={index} className="flex items-start mb-8">
                <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white font-bold mr-4">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-lg font-medium text-neutral-900 mb-2">{item.title}</h3>
                  <p className="text-neutral-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Discovery Engine */}
      <section id="discovery" className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-neutral-900 mb-4">Discovery Engine</h2>
          <p className="text-xl text-neutral-600 max-w-3xl mx-auto">
            Optimize your backlinks for search engine discovery with our comprehensive discovery architecture
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-center mb-16">
          <div className="md:w-1/2 mb-8 md:mb-0">
            <div className="relative">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1 h-full bg-neutral-200"></div>
              <div className="relative space-y-12">
                {[
                  'Backlink',
                  'Validation',
                  'Quality',
                  'Crawlability',
                  'Discovery',
                  'Monitoring',
                  'Verification',
                ].map((item, index) => (
                  <div key={index} className="flex items-center">
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full ${index === 0 ? 'bg-primary' : 'bg-neutral-200'} mr-4`}></div>
                    <div className="text-lg font-medium text-neutral-900">{item}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="md:w-1/2">
            <Card>
              <CardHeader>
                <CardTitle>Legitimate Discovery Channels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    'HTML',
                    'RSS',
                    'Atom',
                    'JSON Feed',
                    'WebSub',
                  ].map((channel, index) => (
                    <div key={index} className="flex items-center">
                      <svg className="w-5 h-5 text-primary mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-neutral-700">{channel}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        <div className="text-center">
          <Badge variant="warning" size="md">Discovery is not indexing. Search engines make the final indexing decision.</Badge>
        </div>
      </section>

      {/* Analytics Preview */}
      <section className="bg-neutral-100 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-neutral-900 mb-4">Analytics Preview</h2>
            <p className="text-xl text-neutral-600 max-w-3xl mx-auto">
              Track the performance of your backlink workflow with our comprehensive analytics dashboard
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Indexing Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-neutral-100 rounded-lg flex items-center justify-center">
                  <p className="text-neutral-500">Chart placeholder</p>
                </div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Discovery Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-32 bg-neutral-100 rounded-lg flex items-center justify-center">
                    <p className="text-neutral-500">Chart placeholder</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Quality Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-32 bg-neutral-100 rounded-lg flex items-center justify-center">
                    <p className="text-neutral-500">Chart placeholder</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Priority</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-32 bg-neutral-100 rounded-lg flex items-center justify-center">
                    <p className="text-neutral-500">Chart placeholder</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Domain Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-32 bg-neutral-100 rounded-lg flex items-center justify-center">
                    <p className="text-neutral-500">Chart placeholder</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-neutral-900 mb-4">Security & Trust</h2>
          <p className="text-xl text-neutral-600 max-w-3xl mx-auto">
            Your backlinks and data are protected with enterprise-grade security measures
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { title: 'SSRF Protection', description: 'Prevent Server-Side Request Forgery attacks' },
            { title: 'Private IP Blocking', description: 'Block requests to private IP ranges' },
            { title: 'Redirect Validation', description: 'Verify all redirects before processing' },
            { title: 'Domain Rate Limits', description: 'Prevent abuse with domain-level rate limiting' },
            { title: 'Tenant Isolation', description: 'Isolate user data with strict tenant separation' },
            { title: 'No Credential Exposure', description: 'Never expose sensitive credentials' },
          ].map((item, index) => (
            <Card key={index} className="transition-all hover:shadow-lg">
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-600">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-primary py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Turn Your Backlink List Into a Crawlable Workflow</h2>
          <div className="flex justify-center space-x-4">
            <Link href="/signup">
              <Button variant="secondary" size="lg">Start Free</Button>
            </Link>
            <Link href="/internal">
              <Button variant="outline" size="lg">View Dashboard</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">Product</h3>
              <ul className="space-y-2">
                <li><Link href="#features" className="text-neutral-300 hover:text-white">Features</Link></li>
                <li><Link href="#discovery" className="text-neutral-300 hover:text-white">Discovery</Link></li>
                <li><Link href="#monitoring" className="text-neutral-300 hover:text-white">Monitoring</Link></li>
                <li><Link href="#verification" className="text-neutral-300 hover:text-white">Verification</Link></li>
                <li><Link href="/internal" className="text-neutral-300 hover:text-white">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><Link href="#documentation" className="text-neutral-300 hover:text-white">Documentation</Link></li>
                <li><Link href="#api" className="text-neutral-300 hover:text-white">API</Link></li>
                <li><Link href="#guides" className="text-neutral-300 hover:text-white">Guides</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><Link href="#about" className="text-neutral-300 hover:text-white">About</Link></li>
                <li><Link href="#contact" className="text-neutral-300 hover:text-white">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><Link href="#privacy" className="text-neutral-300 hover:text-white">Privacy</Link></li>
                <li><Link href="#terms" className="text-neutral-300 hover:text-white">Terms</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-neutral-800 mt-12 pt-8 text-center text-neutral-400">
            <p>&copy; {new Date().getFullYear()} Backlink Indexer. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;