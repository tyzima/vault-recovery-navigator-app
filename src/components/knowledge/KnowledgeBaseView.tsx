import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, HelpCircle, BookOpen, Lightbulb, Shield } from 'lucide-react';
import knowledgeBaseData from '@/data/knowledgeBase.json';
interface FAQ {
  id: string;
  question: string;
  answer: string;
}
interface Acronym {
  id: string;
  acronym: string;
  definition: string;
}
interface SearchResult {
  id: string;
  type: 'faq' | 'acronym';
  title: string;
  content: string;
  original: FAQ | Acronym;
}
export function KnowledgeBaseView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('faq');
  const filteredFAQ = useMemo(() => {
    if (!searchQuery) return knowledgeBaseData.faq as FAQ[];
    return knowledgeBaseData.faq.filter((item: FAQ) => item.question.toLowerCase().includes(searchQuery.toLowerCase()) || item.answer.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery]);
  const filteredAcronyms = useMemo(() => {
    if (!searchQuery) return knowledgeBaseData.acronyms as Acronym[];
    return knowledgeBaseData.acronyms.filter((item: Acronym) => item.acronym.toLowerCase().includes(searchQuery.toLowerCase()) || item.definition.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery]);
  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const faqResults: SearchResult[] = filteredFAQ.map(faq => ({
      id: `faq-${faq.id}`,
      type: 'faq' as const,
      title: faq.question,
      content: faq.answer,
      original: faq
    }));
    const acronymResults: SearchResult[] = filteredAcronyms.map(acronym => ({
      id: `acronym-${acronym.id}`,
      type: 'acronym' as const,
      title: acronym.acronym,
      content: acronym.definition,
      original: acronym
    }));
    return [...faqResults, ...acronymResults];
  }, [searchQuery, filteredFAQ, filteredAcronyms]);
  return <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Header Section */}
      <div className="relative overflow-hidden bg-card border-b rounded-lg">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 rounded-lg" />
        <div className="relative px-6 py-8">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex justify-center">
              <div className="p-3 bg-primary/10 rounded-full">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search Section */}
        <div className="mb-8">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search knowledge base..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-12 bg-card shadow-sm border-2 focus:border-primary/20" />
          </div>
        </div>

        {/* Stats Cards */}
        

        {/* Search Results or Tabs */}
        {searchQuery ? <div className="space-y-6">
            <div className="flex items-center gap-2 mb-6">
              <Search className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">
                Search Results ({searchResults.length} {searchResults.length === 1 ? 'item' : 'items'} found)
              </h2>
            </div>
            
            {searchResults.length === 0 ? <Card className="border-dashed">
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground py-8">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">No results found</p>
                    <p className="text-sm">Try adjusting your search terms or browse all items.</p>
                  </div>
                </CardContent>
              </Card> : <div className="grid gap-6 lg:grid-cols-2">
                {searchResults.map(result => <Card key={result.id} className="group hover:shadow-md transition-all duration-200 border-l-4 border-l-primary/20 hover:border-l-primary">
                    <CardHeader className="pb-3">
                      <div className="flex items-start space-x-3">
                        <div className="p-1.5 bg-primary/10 rounded-md group-hover:bg-primary/20 transition-colors">
                          {result.type === 'faq' ? <Lightbulb className="h-4 w-4 text-primary" /> : <BookOpen className="h-4 w-4 text-primary" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${result.type === 'faq' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                              {result.type === 'faq' ? 'FAQ' : 'Acronym'}
                            </span>
                          </div>
                          <CardTitle className="text-lg leading-tight text-left">{result.title}</CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground leading-relaxed text-left">{result.content}</p>
                    </CardContent>
                  </Card>)}
              </div>}
          </div> : (/* Tabs Section */
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50">
              <TabsTrigger value="faq" className="flex items-center gap-2 data-[state=active]:bg-background">
                <HelpCircle className="h-4 w-4" />
                Frequently Asked Questions
              </TabsTrigger>
              <TabsTrigger value="acronyms" className="flex items-center gap-2 data-[state=active]:bg-background">
                <BookOpen className="h-4 w-4" />
                Cyber Terminology
              </TabsTrigger>
            </TabsList>

            <TabsContent value="faq" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {(knowledgeBaseData.faq as FAQ[]).map(faq => <Card key={faq.id} className="group hover:shadow-md transition-all duration-200 border-l-4 border-l-primary/20 hover:border-l-primary">
                    <CardHeader className="pb-3">
                      <div className="flex items-start space-x-3">
                        <div className="p-1.5 bg-primary/10 rounded-md group-hover:bg-primary/20 transition-colors">
                          <Lightbulb className="h-4 w-4 text-primary" />
                        </div>
                        <CardTitle className="text-lg leading-tight text-left">{faq.question}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground leading-relaxed text-left">{faq.answer}</p>
                    </CardContent>
                  </Card>)}
              </div>
            </TabsContent>

            <TabsContent value="acronyms" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(knowledgeBaseData.acronyms as Acronym[]).map(acronym => <Card key={acronym.id} className="group hover:shadow-md transition-all duration-200 bg-gradient-to-br from-card to-muted/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-2xl font-bold text-primary group-hover:text-primary/80 transition-colors text-left">
                        {acronym.acronym}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed text-left">{acronym.definition}</p>
                    </CardContent>
                  </Card>)}
              </div>
            </TabsContent>
          </Tabs>)}

        {/* Footer CTA */}
        <div className="mt-12 text-center">
          <Card className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-primary/20">
            <CardContent className="p-8">
              <h3 className="text-xl font-semibold mb-2">Need Additional Help?</h3>
              <p className="text-muted-foreground mb-4">
                Can't find what you're looking for? Our support team is here to help 24/7.
              </p>
              <div className="flex items-center justify-center space-x-2 text-lg font-medium text-primary">
                <Shield className="h-5 w-5" />
                <span>Emergency Support: 1-800 KELYN</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>;
}