import React, { useEffect, useState } from 'react';

const testimonials = [
    {
        id: 1,
        name: "Harry Ryder",
        role: "Crypto Trader",
        text: "This app has completely transformed how I handle my crypto taxes. The automatic categorization of trades saves me hours of work.",
        avatar: "HR"
    },
    {
        id: 2,
        name: "James Orchard",
        role: "DeFi Developer",
        text: "Finally, a tax app that understands DeFi! The way it handles complex transactions and internal transfers is brilliant.",
        avatar: "JO"
    },
    {
        id: 3,
        name: "Corey Finlay",
        role: "NFT Artist",
        text: "As someone deep in the NFT space, I needed something that could track my sales accurately. This app does exactly that and more.",
        avatar: "CF"
    }
];

export default function Testimonials() {
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex((current) => (current + 1) % testimonials.length);
        }, 5000); // Change testimonial every 5 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="py-16 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold gradient-text mb-4">
                        What Our Users Say
                    </h2>
                    <p className="text-geist-accent-600 dark:text-geist-accent-400">
                        Join thousands of satisfied users who've simplified their crypto taxes
                    </p>
                </div>

                <div className="relative">
                    {/* Background blur effects */}
                    <div className="absolute inset-0 flex items-center pointer-events-none">
                        <div className="w-1/3 h-64 bg-geist-success/10 rounded-full blur-3xl"></div>
                        <div className="w-1/3 h-64 bg-blue-500/10 rounded-full blur-3xl translate-x-full"></div>
                    </div>

                    {/* Testimonials slider */}
                    <div className="relative">
                        <div className="flex transition-transform duration-500 ease-out"
                             style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
                            {testimonials.map((testimonial) => (
                                <div key={testimonial.id} 
                                     className="w-full flex-shrink-0 px-4"
                                     style={{ scrollSnapAlign: 'start' }}>
                                    <div className="glass hover-lift p-8 rounded-2xl max-w-2xl mx-auto">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-geist-success to-blue-500 flex items-center justify-center text-white font-medium">
                                                {testimonial.avatar}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-geist-accent-900 dark:text-white">
                                                    {testimonial.name}
                                                </h3>
                                                <p className="text-sm text-geist-accent-600 dark:text-geist-accent-400">
                                                    {testimonial.role}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-lg text-geist-accent-700 dark:text-geist-accent-300 italic">
                                            "{testimonial.text}"
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Navigation dots */}
                        <div className="flex justify-center mt-8 gap-2">
                            {testimonials.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setActiveIndex(index)}
                                    className={`w-2 h-2 rounded-full transition-all duration-300 
                                        ${index === activeIndex 
                                            ? 'w-8 bg-geist-success' 
                                            : 'bg-geist-accent-300 dark:bg-geist-accent-600'}`}
                                    aria-label={`Go to testimonial ${index + 1}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 